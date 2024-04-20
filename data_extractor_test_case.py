import unittest
import json
from get_neo_data import data_extractor

class DataExtractorTestCase(unittest.TestCase):

    def test_equal_orbit_determination_dates_result_in_none(self):
        asteroidJson = json.loads("""
                            {
                                "close_approach_data": [
                                ],
                                "orbital_data": {
                                    "orbit_determination_date": "2001-01-05 12:00:00"
                                }
                            }
                        """)
        historic_orbit_determination_date = "2001-01-05 12:00:00"
        self.assertIsNone(data_extractor( asteroidJson['close_approach_data'], asteroidJson['orbital_data']['orbit_determination_date'], historic_orbit_determination_date ))


    def test_newer_orbit_determination_date_result_in_close_approach_data_list(self):
        asteroidJson = json.loads("""
                            {
                                "close_approach_data": [
                                    {
                                        "close_approach_date_full": "2000-Jan-01 12:00"
                                    },
                                    {
                                        "close_approach_date_full": "2001-Jan-01 12:00"
                                    },
                                    {
                                        "close_approach_date_full": "2002-Jan-01 12:00"
                                    },
                                    {
                                        "close_approach_date_full": "2003-Jan-01 12:00"
                                    }
                                ],
                                "orbital_data": {
                                    "orbit_determination_date": "2001-01-06 12:00:00"
                                }
                            }
                        """)
        historic_orbit_determination_date = "2001-01-05 12:00:00"

        expected_close_approach_data = [{"close_approach_date_full": "2002-Jan-01 12:00"}, { "close_approach_date_full": "2003-Jan-01 12:00"}]
        returned_close_approach_data = data_extractor( asteroidJson['close_approach_data'], asteroidJson['orbital_data']['orbit_determination_date'], historic_orbit_determination_date )

        self.assertListEqual(expected_close_approach_data, returned_close_approach_data)


if __name__ == '__main__':
    unittest.main()