import requests
import json
import time

class NeoApi:
    browse_all_uri = 'https://api.nasa.gov/neo/rest/v1/neo/browse'

    def __init__(self, api_key: str):
        self.params = {'API_KEY': api_key}


def data_extractor(close_approach_data: list, orbit_determinatin_date: str, historic_orbit_determination_date: str) -> list | None:
    orbit_determinatin_date_format = "%Y-%m-%d %H:%M:%S"
    close_approach_date_full_format = "%Y-%b-%d %H:%M"

    current_date = time.strptime(orbit_determinatin_date,  orbit_determinatin_date_format)
    historic_date = time.strptime(historic_orbit_determination_date,  orbit_determinatin_date_format)

    if (current_date <= historic_date):
        return None
    
    is_close_approach_date_newer = lambda close_approach_date, current_date : current_date < time.strptime(close_approach_date, close_approach_date_full_format)
    
    return [entry for entry in close_approach_data if is_close_approach_date_newer(entry["close_approach_date_full"], current_date)]
        
