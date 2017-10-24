# Build stage
FROM node:8

ENV NODE node8
ENV PLATFORM linux
ENV ARCH x64

WORKDIR /usr/src
RUN yarn global add pkg

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN pkg -t ${NODE}-${PLATFORM}-${ARCH} app.js

# Run stage
FROM debian:jessie-slim
COPY --from=0 /usr/src/app /
CMD ["./app"]
