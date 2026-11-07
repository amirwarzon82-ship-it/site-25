FROM php:8.3-apache

# ماژول‌های لازم برای .htaccess پروژه
# فقط یک MPM (prefork) فعال باشد، چون mod_php فقط با آن کار می‌کند
RUN a2dismod mpm_event mpm_worker 2>/dev/null || true; \
    rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.*; \
    a2enmod mpm_prefork rewrite headers expires \
 && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:*>/' /etc/apache2/sites-available/000-default.conf

COPY docker/apache.conf /etc/apache2/conf-available/classpanel.conf
RUN a2enconf classpanel

COPY site/ /var/www/html/
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && chown -R www-data:www-data /var/www/html

ENV DATA_DIR=/data
ENTRYPOINT ["entrypoint.sh"]
CMD ["apache2-foreground"]
