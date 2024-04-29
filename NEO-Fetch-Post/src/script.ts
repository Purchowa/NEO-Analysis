import axios, { AxiosResponse } from 'axios';
import * as http from 'http';
import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';
import { NearEarthObject, NeoApiResponse } from './model';

dotenv.config();

const uri: string = process.env.DB_URI || '';
const client: MongoClient = new MongoClient(uri);
let pages: number;
let remainingRequests: number = 1000;

async function fetchData(page: number): Promise<NeoApiResponse | null> {
    try {
        const response: AxiosResponse = await axios.get(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=${page}&size=20&api_key=${process.env.API_KEY}`);        
        remainingRequests = parseInt(response.headers['x-ratelimit-remaining']);        
        const data: NeoApiResponse = response.data;

        return data;
    } catch (error) {
        console.error('An error occurred while fetching data:', error);
        return null;
    }
}

async function fetchAndSaveAsteroidsData(start: number, stop: number): Promise<void> {
    try {
        const database: Db = client.db(process.env.DB_NAME);
        const collection: Collection<NearEarthObject> = database.collection("asteroids");
        const fetchDate: string = new Date().toLocaleDateString();

        for (let i = start; i <= stop; i++) {
            const data: NeoApiResponse | null = await fetchData(i);
            
            if(data === null) {
                console.log(`Remaining requests: ${remainingRequests}`);
            }

            if (data && data.near_earth_objects) {
                for (const asteroid of data.near_earth_objects) {
                    const asteroidDB = await collection.findOne({ neo_reference_id: asteroid.neo_reference_id });
                    const document: NearEarthObject = {
                        ...asteroid,
                        fetched_on: fetchDate,
                        is_latest: true
                    }

                    if (asteroidDB === null) {
                        await collection.insertOne(document);
                        console.log("***Fetched from NASA API and saved new asteroid " + asteroid.name + " to DB from page: " + i + "***");

                    } else if (asteroidDB!!.orbital_data.orbit_determination_date !== asteroid.orbital_data.orbit_determination_date && asteroidDB.is_latest) {

                        await collection.insertOne(document);
                        console.log("***Saving new orbit_determination_date for existing asteroid " + asteroidDB.name + "***");
                        await collection.updateOne({ _id: asteroidDB._id }, { $set: { is_latest: false } });
                    } else {
                        console.log("***orbit_determination_date for " + asteroid.name + " is not newer - skipping***");
                    }
                }
            }

        }
    } catch (error) {
        console.error('An error occurred while connecting to the database:', error);
    }
}

async function setTotalPages(): Promise<void> {
    try {
        const response: any = await axios.get(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=0&size=20&api_key=${process.env.API_KEY}`);
        const pageJson: NearEarthObject = response.data;
        pages = pageJson.page.total_pages;        
    } catch (error) {
        console.error('An error occurred while fetching or processing data:', error);
    }
}

async function start(): Promise<void> {
    try {
        await setTotalPages();
        await client.connect();

        console.log("Total pages:" + pages);

        console.log("***Connected to DB***");
        console.log("***Fetching asteroids data***");

        const batchSize = 20;
        const startPages: number[] = [];
        for (let i = 0; i <= pages; i += batchSize) {
            startPages.push(i);
        }

        await Promise.all(startPages.map(async startPage => {
            const endPage = startPage + batchSize - 1;
            await fetchAndSaveAsteroidsData(startPage, endPage);

            if (remainingRequests === 0) {
                console.log("Request limit reached. Waiting for one hour to process the rest");
                await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 60));
                remainingRequests = 1000;
            }
        }));

    } catch (error) {
        console.error('An error occurred while connecting to the database:', error);
    } finally {
        await client.close();
    }
}

const server = http.createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Asteroids data fetching server running...');
});

server.listen(process.env.PORT, async () => {
    console.log(`Server running on port ${process.env.PORT}`);
    await start();
    setInterval(start, 1000 * 60 * 60 * 24);
});

