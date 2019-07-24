
    crontab -l

    */6     *       *       *       *       cd pluspool-led-scrape-data && AWS_ACCESS_KEY_ID=MY_ID AWS_SECRET_ACCESS_KEY=MY_SECRET node index.js
