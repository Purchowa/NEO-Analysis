import fetch from 'node-fetch';
import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';
import { NearEarthObject, NeoApiResponse } from './model';

dotenv.config();

const uri: string = process.env.DB_URI || '';
const client: MongoClient = new MongoClient(uri);

async function fetchData(page: number): Promise<NeoApiResponse | null> {
    try {
        const response = await fetch(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=${page}&size=20&api_key=${process.env.API_KEY}`);
        const data = await response.json();
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

        for (let i = start; i <= stop; i++) {
            const data: NeoApiResponse | null = await fetchData(i);

            if (data && data.near_earth_objects) {
                const fetchDate: string = new Date().toISOString().slice(0, 10);

                const documents: NearEarthObject[] = data.near_earth_objects.map(asteroid => ({
                    ...asteroid,
                    fetched_on: fetchDate
                }));

                await collection.insertMany(documents);

                console.log("***Fetched from NASA API and saved data to DB from page: " + i + "***");
            }
        }
    } catch (error) {
        console.error('An error occurred while connecting to the database:', error);
    }
}

async function start() {
    try {
        await client.connect();

        console.log("***Connected to DB***");
        console.log("***Fetching asteroids data***");

        // Trzeba dostosować, że jeśli orbit_determination_date jest większa przy kolejnym odczycie to należy ją dodać do bazy, w przeciwnym wypadku pominąć asteroidę
        const batchSize = 20;
        const startPages: number[] = [];
        for (let i = 0; i <= 1000; i += batchSize) {
            startPages.push(i);
        }
        
        await Promise.all(startPages.map(startPage => {
            const endPage = startPage + batchSize - 1;
            return fetchAndSaveAsteroidsData(startPage, endPage);
        }));

    } catch (error) {
        console.error('An error occurred while connecting to the database:', error);
    } finally {
        await client.close();
        process.exit();
    }
}

start();
