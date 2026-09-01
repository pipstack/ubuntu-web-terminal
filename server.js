const express = require("express");
const http = require("http");
const crypto = require("crypto");
const pty = require("node-pty");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 10000;
const PASSWORD = process.env.TERMINAL_PASSWORD;

if (!PASSWORD) {
    console.error("ERROR: TERMINAL_PASSWORD is not set");
    process.exit(1);
}

app.use(express.json());
app.use(express.static("public"));

function createToken() {
    return crypto.randomBytes(32).toString("hex");
}

const sessions = new Set();

app.post("/login", (req, res) => {
    const password = req.body?.password;

    if (
        typeof password !== "string" ||
        password.length === 0 ||
        password.length > 200
    ) {
        return res.status(401).json({ error: "Invalid password" });
    }

    const supplied = Buffer.from(password);
    const expected = Buffer.from(PASSWORD);

    if (
        supplied.length !== expected.length ||
        !crypto.timingSafeEqual(supplied, expected)
    ) {
        return res.status(401).json({ error: "Invalid password" });
    }

    const token = createToken();
    sessions.add(token);

    res.json({ token });
});

wss.on("connection", (ws, req) => {
    const url = new URL(
        req.url,
        `http://${req.headers.host}`
    );

    const token = url.searchParams.get("token");

    if (!token || !sessions.has(token)) {
        ws.close(1008, "Unauthorized");
        return;
    }

    const shell = pty.spawn("/bin/bash", ["--login"], {
        name: "xterm-256color",
        cols: 100,
        rows: 30,
        cwd: "/root",
        env: {
            ...process.env,
            TERM: "xterm-256color",
            PS1: "root@pentest-lab:~# "
        }
    });

    shell.write("hostname pentest-lab\r");
    shell.write("export PS1='root@pentest-lab:~# '\r");

    shell.onData((data) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(data);
        }
    });

    ws.on("message", (message) => {
        shell.write(message.toString());
    });

    ws.on("close", () => {
        shell.kill();
        sessions.delete(token);
    });

    shell.onExit(() => {
        if (ws.readyState === ws.OPEN) {
            ws.close();
        }

        sessions.delete(token);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Ubuntu Web Terminal running on port ${PORT}`);
});
