FROM node:20
WORKDIR /app
COPY . .
EXPOSE 80
EXPOSE 443
RUN npm install && npm run update && npm run build
CMD ["npm", "run", "start"]