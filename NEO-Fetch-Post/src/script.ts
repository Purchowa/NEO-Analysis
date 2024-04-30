import axios, { AxiosResponse } from 'axios';
import * as http from 'http';
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import { NearEarthObject, NeoApiResponse } from './model';
import * as fs from 'fs';
import * as path from 'path'
import * as ejs from 'ejs';
import { renderFile } from 'ejs';

dotenv.config();
const express = require('express');
const app = express();

const uri: string = process.env.DB_URI || '';
const client: MongoClient = new MongoClient(uri);
let pages: number;
let remainingRequests: number = 1000;
const batchSize = 20;

app.set('view engine', 'html');
app.engine('html', renderFile);

app.get('/', async (req: any, res: any) => {
    try {
        const page: number = parseInt(req.query.page as string) || 1;
        const asteroidData: NearEarthObject[] = await getAsteroidsFromDB(page);
        console.log("MONGO_ID " + asteroidData[0].mongoId);
        let totalPages: number;
        const pagesFromFetch: number = await getTotalPages();

        if(pagesFromFetch === 0) {
            console.log("Didn't fetch from API. Fetching from DB");
            totalPages = await getTotalPagesFromDB();
        } else {
            totalPages = pagesFromFetch;
        }
        res.render(path.join(__dirname, "../public/index.html"), { asteroids: asteroidData, currentPage: page, totalPages });
    } catch (error) {
        console.error('Error fetching asteroid data from DB:', error);
        res.status(500).send('Error fetching asteroid data from DB');
    }
});

app.get('/details/:id', async (req: any, res: any) => {
    try {
        const asteroidId = req.params.id;
        if (!ObjectId.isValid(asteroidId)) {
            return res.status(400).send('Invalid asteroid ID');
        }
        
        await client.connect();
        const database: Db = client.db(process.env.DB_NAME);
        const collection: Collection<NearEarthObject> = database.collection("asteroids");
        const asteroid: NearEarthObject | null = await collection.findOne({ _id: new ObjectId(asteroidId) });

        if (!asteroid) {
            return res.status(404).send('Asteroid not found');
        }

        res.render(path.join(__dirname, "../public/asteroid_details.html"), { asteroid });
    } catch (error) {
        console.error('Error fetching asteroid details:', error);
        res.status(500).send('Error fetching asteroid details');
    }
});


async function getAsteroidsFromDB(page: number): Promise<NearEarthObject[]> {
    try {
        await client.connect();
        const database: Db = client.db(process.env.DB_NAME);
        const collection: Collection<NearEarthObject> = database.collection("asteroids");
        const asteroids: NearEarthObject[] = await collection.find().skip((page - 1) * batchSize).limit(batchSize).toArray();
        return asteroids;
    } catch (error) {
        console.error('An error occurred while fetching asteroids from DB:', error);
        throw error;
    }
}

async function getTotalPagesFromDB(): Promise<number> {
    try {
        await client.connect();
        const database: Db = client.db(process.env.DB_NAME);
        const collection: Collection<NearEarthObject> = database.collection("asteroids");
        const elements = await collection.countDocuments();
        return elements / 20;
    } catch (error) {
        console.error('An error occurred while fetching asteroids from DB:', error);
        throw error;
    }
}

async function fetchData(page: number): Promise<NeoApiResponse | null> {
    let response: AxiosResponse;
    try {
        response = await axios.get(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=${page}&size=20&api_key=${process.env.API_KEY}`);
        remainingRequests = parseInt(response.headers['x-ratelimit-remaining']);        
        const data: NeoApiResponse = response.data;

        return data;
    } catch (error) {
        console.error('***Error when fetching - reached request limit probably***' + error);

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

            if (remainingRequests === 0) {
                console.log("Request limit reached. Waiting for one hour to process the rest");
                await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 60));
                remainingRequests = 2000;
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
                    }
                    // else {
                    //     console.log("***orbit_determination_date for " + asteroid.name + " is not newer - skipping***");
                    // }
                }
            }
        }
    } catch (error) {
        console.error('An error occurred while connecting to the database:', error);
    }
}

async function getTotalPages(): Promise<number> {
    try {
        const response: any = await axios.get(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=0&size=20&api_key=${process.env.API_KEY}`);
        const pageJson: NearEarthObject = response.data;
        return pageJson.page.total_pages;
    } catch (error) {
        console.error('***Error with fetching. Probably request limit reached***');
        return 0;
    }
}

async function start(): Promise<void> {
    try {
        await getTotalPages();        
        console.log("***Connected to DB***");
        console.log("***Fetching asteroids data***");

        let totalPages: number;        

        const pagesFromFetch: number = await getTotalPages();

        if(pagesFromFetch === 0) {
            console.log("Didn't fetch from API. Fetching from DB");
            totalPages = await getTotalPagesFromDB();
        } else {
            totalPages = pagesFromFetch;
        }


        const startPages: number[] = [];
        for (let i = 0; i <= totalPages; i += batchSize) {
            startPages.push(i);
        }

        await Promise.all(startPages.map(async startPage => {
            const endPage = startPage + batchSize - 1;
            await fetchAndSaveAsteroidsData(startPage, endPage);
        }));

    } catch (error) {
        console.error('An error occurred while connecting to the database:', error);
    } finally {
        await client.close();
    }
}

app.listen(process.env.PORT, async () => {
    console.log(`Server running on port ${process.env.PORT}`);
    await start();
    setInterval(start, 1000 * 60 * 60 * 24);
});

