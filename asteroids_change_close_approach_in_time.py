import os
from datetime import datetime
import pandas as pd

import matplotlib.pyplot as plt
import seaborn as sns
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

def get_mongo_uri():
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise ValueError("MONGO_URI environment variable not set")
    return uri


def get_chunk_of_asteroids(name='', limit_asteroids=100, offset=0):
    uri = get_mongo_uri()
    client = MongoClient(uri)
    db = client["NEO-Cluster"]
    collection = db["asteroids"]

    query = {}
    if name:
        query["name"] = name

    asteroids = collection.find(query).limit(limit_asteroids).skip(offset)
    return list(asteroids)


def draw_plots_for_specific_asteroid(name=''):
    data = get_chunk_of_asteroids(name=name)

    if not data:
        print("No data found for the specified asteroid.")
        return

    velocities_dates = []
    velocities = []



    for entry in data:
        try:
            close_approach_data = entry['close_approach_data']
            for obj in close_approach_data:
                velocities_dates.append(obj['close_approach_date'])
                velocities.append(float(obj['relative_velocity']['kilometers_per_second']))
        except (ValueError, KeyError) as e:
            print(f"Error processing entry: {e}")
            continue

    df = pd.DataFrame({'date': velocities_dates, 'velocity_km_s': velocities})
    df['year'] = df['date'].str[:4]
    sns.set(style="whitegrid")

    plt.figure(figsize=(19, 9))
    sns.lineplot(data=df, x='year', y='velocity_km_s', marker='o')
    plt.title('Velocity km/s')
    plt.xlabel('Year')
    plt.ylabel('Velocity')
    plt.tight_layout()
    plt.show()


draw_plots_for_specific_asteroid(name='433 Eros (A898 PA)')

