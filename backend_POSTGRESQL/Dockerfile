FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libicu-dev \
    libonig-dev \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo_pgsql \
    pgsql \
    mbstring \
    zip \
    bcmath \
    gd \
    intl

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

RUN useradd -m -u 1000 -U -s /bin/bash -d /home/jalankita jalankita

WORKDIR /var/www

EXPOSE 8080

USER jalankita

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8080"]
