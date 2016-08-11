FROM node:6.3
ENV name /classmere_scraper
RUN mkdir $name
WORKDIR $name
ADD . $name/
RUN npm install