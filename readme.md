This codebase is intended to scrape data from multiple sources and upload a file to S3 that https://water.pluspool.org uses. The codebase currently scrapes data from two Datagarrison endpoints as well as one NOAA API endpoint. It takes these data sources and creates data samples for every 6 minutes. The reason 6 minutes was chosen is because this is the smallest granularity of time our sources have. NOAA gives us data every 6 minutes while Datagarrison every 15 minutes.  

# Setup

Set the necessary environment variables however you prefer

    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_BUCKET

# Make sure CORS Configuration is correct for the S3 bucket

Ensure that the S3 bucket you are using has this CORS configuration in order for our front-end app to hit it:

```xml
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

# Production

We run this on github actions runner, every 6 minutes. See [.github/workflows/scrape-data.yml]()
