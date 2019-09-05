# Setup

Copy `.env.example` and populate with AWS keys.

# CORS Configuration

Ensure that the S3 bucket you are using has this CORS configuration in order for our front-end app to hit it:

```
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
    <AllowedHeader>*</AllowedHeader>
</CORSRule>
</CORSConfiguration>
```

# Running once

```
$ cd pluspool-led-scrape-data && source .env && node index.js
```

# Running every 6 minutes

Create crontab file using command and file contents below

```
$ crontab -e
```

```
*/6     *       *       *       *       cd pluspool-led-scrape-data && source .env && node index.js
```
