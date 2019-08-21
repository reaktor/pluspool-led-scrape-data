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

# Running

```
source .env
node index.js
```
