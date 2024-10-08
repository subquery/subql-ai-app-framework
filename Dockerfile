FROM denoland/deno:2.0.0-rc.10

WORKDIR /ai-app

# Prefer not to run as root.
USER deno

COPY . .
RUN deno cache ./src/index.ts

ENTRYPOINT ["./src/index.ts"]

CMD ["-p","/app"]