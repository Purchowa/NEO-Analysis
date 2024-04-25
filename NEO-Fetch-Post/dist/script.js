"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const mongodb_1 = require("mongodb");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const uri = process.env.DB_URI || '';
const client = new mongodb_1.MongoClient(uri);
let pages;
function fetchData(page) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield (0, node_fetch_1.default)(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=${page}&size=20&api_key=${process.env.API_KEY}`);
            const data = yield response.json();
            return data;
        }
        catch (error) {
            console.error('An error occurred while fetching data:', error, ' from page: ', page, ' error: ', error);
            return null;
        }
    });
}
function fetchAndSaveAsteroidsData(start, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const database = client.db(process.env.DB_NAME);
            const collection = database.collection("asteroids");
            for (let i = start; i <= stop; i++) {
                const data = yield fetchData(i);
                if (data && data.near_earth_objects) {
                    const fetchDate = new Date().toISOString().slice(0, 10);
                    for (const asteroid of data.near_earth_objects) {
                        const asteroidDB = yield collection.findOne({ neo_reference_id: asteroid.neo_reference_id });
                        const document = Object.assign(Object.assign({}, asteroid), { fetched_on: fetchDate });
                        if (asteroidDB === null) {
                            yield collection.insertOne(document);
                            console.log("***Fetched from NASA API and saved new asteroid " + asteroid.name + " to DB from page: " + i + "***");
                        }
                        else if (asteroidDB.orbital_data.orbit_determination_date !== asteroid.orbital_data.orbit_determination_date) {
                            yield collection.insertOne(document);
                            console.log("***Saving new orbit_determination_date for existing asteroid " + asteroidDB.name + "***");
                        }
                        else {
                            console.log("***orbit_determination_date for " + asteroid.name + " is not newer - skipping***");
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('An error occurred while connecting to the database:', error);
        }
    });
}
function setTotalPages() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield (0, node_fetch_1.default)(`https://api.nasa.gov/neo/rest/v1/neo/browse?page=0&size=20&api_key=${process.env.API_KEY}`);
        const pageJson = yield response.json();
        pages = pageJson.page.total_pages;
    });
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield setTotalPages();
            yield client.connect();
            console.log("***Connected to DB***");
            console.log("***Fetching asteroids data***");
            const batchSize = 20;
            const startPages = [];
            for (let i = 0; i <= pages; i += batchSize) {
                startPages.push(i);
            }
            yield Promise.all(startPages.map(startPage => {
                const endPage = startPage + batchSize - 1;
                return fetchAndSaveAsteroidsData(startPage, endPage);
            }));
        }
        catch (error) {
            console.error('An error occurred while connecting to the database:', error);
        }
        finally {
            yield client.close();
            process.exit();
        }
    });
}
const test = () => {
    console.log("Co sekunde");
};
//setInterval(start, 1000 * 60 * 2);
start();
