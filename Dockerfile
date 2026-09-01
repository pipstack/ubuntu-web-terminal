FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y \
    nodejs \
    npm \
    build-essential \
    python3 \
    bash \
    curl \
    wget \
    nano \
    vim \
    procps \
    iproute2 \
    iputils-ping \
    net-tools \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install

COPY server.js .
COPY public ./public

EXPOSE 10000

CMD ["node", "server.js"]
