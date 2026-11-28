FROM postgres:17.11-alpine3.24
RUN apk add --no-cache age~1.3.2 aws-cli~2.34.63 supercronic~0.2.49
COPY --chmod=755 lib.sh backup.sh check.sh bucket.sh fetch.sh /backup/
COPY crontab lifecycle.json /backup/
USER postgres
CMD ["supercronic", "-json", "/backup/crontab"]
