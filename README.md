## Using Docker with bondage club for development
 1. Install [Docker](https://docs.docker.com/get-docker/)
 2. Make sure you also install `docker-compose`, Docker Desktop comes with this tool, but Linux does not. If you already have Docker installed, make sure it's at least of version `18.06.0` or higher.
 3. Clone this repo and `Bondage-College` into the same folder so you have the following structure:
```
$ ls -l
total 8
drwxr-xr-x  18 user  staff   576 Jun 25 07:28 Bondage-Club-Server
drwxr-xr-x  42 user  staff  1344 Jun 23 22:14 Bondage-College
```
 4. `cd Bondage-Club-Server`
 5. `cp .env.example .env`
 6. run `docker-compose up -d --build`, this will build and start up the required containers, the latter command can be repeated to update the Bondage-Club-Server if you've made server changes.

Make the required changes to index.html in your Bondage-Club repository, and it will now be available at http://localhost/BondageClub/

 * Mongo runs at localhost:27017, by default with the username and password `admin` and `password`, this can be changed in the .env file `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`
 * Mongo-Express runs in a separate container at http://localhost:8081 and lets you access the database

### Convenience commands
 * `docker-compose down` Tear down and remove all containers but not the mongo database
 * `docker-compose down --volumes` Remove all the containers and the mongo database
 * `docker-compose up -d --build` build the server with any changes and start it up
 * `docker-compose up -d --build --no-cache` rebuild the server and start it up
 * `docker-compose logs app` View the logs from the bondage club server
 * `docker-compose logs db` View the logs of Mongo
