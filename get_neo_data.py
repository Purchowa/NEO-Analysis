import requests
import json
import time


class DataExtractor:

    formats = {
        "orbit_determinatin_date": "%Y-%m-%d %H:%M:%S",
        "close_approach_date_full": "%Y-%b-%d %H:%M"
    }

    def extract_close_approach_data(self, close_approach_data: list, orbit_determinatin_date: str, historic_orbit_determination_date: str) -> list | None:
        
        current_date = time.strptime(orbit_determinatin_date,  self.formats["orbit_determinatin_date"])
        historic_date = time.strptime(historic_orbit_determination_date,  self.formats["orbit_determinatin_date"])

        if (current_date <= historic_date):
            return None
        
        is_close_approach_date_newer = lambda close_approach_date, current_date : current_date < time.strptime(close_approach_date, self.formats["close_approach_date_full"])
        
        future_close_approach_data = [entry for entry in close_approach_data if is_close_approach_date_newer(entry["close_approach_date_full"], current_date)]

        if len(future_close_approach_data) == 0:
            return None
        else:
            return future_close_approach_data

