# Start Laravel Queue Worker in a new window
# Run this when you need async notifications/email to work

php artisan queue:work --queue=high,default --sleep=3 --max-time=3600
