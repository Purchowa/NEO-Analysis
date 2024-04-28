import fetch from 'node-fetch';
import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';
import { NearEarthObject, NeoApiResponse } from './model';
import { count } from 'console';

dotenv.config();

const uri: string = process.env.DB_URI || '';
const client: MongoClient = new MongoClient(uri);
let pages: number;
let reqCount: number = 0;

function countRequests(): number {
    reqCount++;
    return reqCount;

}

async function fetchData(page: number): Promise<NeoApiResponse | null> {
    try {
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=${page}&size=20&api_key=${process.env.API_KEY}`);
        const data = await response.json();
        countRequests();
        return data as NeoApiResponse;
    } catch (error) {
        console.error('An error occurred while fetching data:', error, ' from page: ', page, ' error: ', error);
        return null;
    }
}

async function fetchAndSaveAsteroidsData(start: number, stop: number): Promise<void> {
    try {
        const database: Db = client.db(process.env.DB_NAME);
        const collection: Collection<NearEarthObject> = database.collection("asteroids");
        const fetchDate: string = new Date().toLocaleDateString();
        const dayBeforeToday: Date = new Date();
        dayBeforeToday.setDate(dayBeforeToday.getDate() - 1);

        for (let i = start; i <= stop; i++) {
            const data: NeoApiResponse | null = await fetchData(i);

            if (data && data.near_earth_objects) {
                for (const asteroid of data.near_earth_objects) {
                    const asteroidDB = await collection.findOne({ neo_reference_id: asteroid.neo_reference_id });
                    const document: NearEarthObject = {
                        ...asteroid,
                        fetched_on: fetchDate
                    }

                    if (asteroidDB === null) {
                        await collection.insertOne(document);
                        console.log("***Fetched from NASA API and saved new asteroid " + asteroid.name + " to DB from page: " + i + "***");

                    } else if (asteroidDB!!.orbital_data.orbit_determination_date !== asteroid.orbital_data.orbit_determination_date && asteroidDB.fetched_on === dayBeforeToday.toLocaleDateString()) {

                        await collection.insertOne(document);
                        console.log("***Saving new orbit_determination_date for existing asteroid " + asteroidDB.name + "***");
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
        const response: any = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=0&size=20&api_key=${process.env.API_KEY}`);
        const pageJson: NearEarthObject = await response.json();        
        pages = pageJson.page.total_pages;
        countRequests();
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

            if(reqCount >= 1000) {
                console.log("Request limit reached. Waiting for one hour to process the rest");
                await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 60));
                reqCount = 0;
            }
        }));

    } catch (error) {
        console.error('An error occurred while connecting to the database:', error);
    } finally {
        await client.close();
    }
}

 start();
 setInterval(start, 1000 * 60 * 60 * 24);

