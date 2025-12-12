# Use nginx alpine for a lightweight container
FROM nginx:alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx static files
RUN rm -rf ./*

# Copy the application files
COPY --chmod=644 index.html .
COPY --chmod=644 README.md .

# Copy styles directory
COPY --chmod=755 styles/ ./styles/

# Copy images directory
COPY --chmod=755 images/ ./images/

# Copy JavaScript modules directory
COPY --chmod=755 js/ ./js/

# Copy custom nginx configuration
COPY --chmod=644 docs/deployment/nginx.conf /etc/nginx/conf.d/default.conf

# Ensure proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
