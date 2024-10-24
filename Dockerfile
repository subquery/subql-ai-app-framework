FROM denoland/deno:2.0.1

WORKDIR /ai-app

# TODO bring this back, the deno user is very restrictive so currently doens't allow using the tmp dir
# RUN mkdir /.cache && chown deno /.cache
# USER deno
# TODO set cacheDir flag on entrypoint once the above works

COPY . .
RUN deno cache ./src/index.ts

ENTRYPOINT ["./src/index.ts"]

CMD ["-p","/ai-app"]