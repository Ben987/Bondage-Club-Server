FROM node:20

WORKDIR /app
ADD package*.json /app/
RUN npm ci
ADD . /app/
CMD [ "npm", "start" ]
