"""
Location Intelligence Module for Disaster Mapping
Handles geocoding, nearby location discovery, and 100km radius calculations
"""

import os
import math
import requests
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers using Haversine formula"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def geocode_location(city: str = None, region: str = None, country: str = None) -> Optional[Dict]:
    """
    Geocode a location using Google Geocoding API with timeout
    Returns: {lat, lng, formatted_address} or None
    """
    query_parts = [city, region, country]
    query = ', '.join([p for p in query_parts if p])
    
    if not query:
        return None
    
    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            'address': query,
            'key': GOOGLE_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=3)  # 3 second timeout
        data = response.json()
        
        if data['status'] == 'OK' and data['results']:
            result = data['results'][0]
            return {
                'lat': result['geometry']['location']['lat'],
                'lng': result['geometry']['location']['lng'],
                'formatted_address': result['formatted_address']
            }
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    return None

def find_nearby_cities(lat: float, lng: float, radius_km: int = 100, max_results: int = 10) -> List[Dict]:
    """
    Find nearby cities/towns within radius using Google Places API
    Returns list of {name, lat, lng, distance_km}
    FAST: Uses timeout and returns immediately if fails
    """
    try:
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            'location': f"{lat},{lng}",
            'radius': radius_km * 1000,  # Convert to meters
            'type': 'locality',
            'key': GOOGLE_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=2)  # 2 second timeout
        data = response.json()
        
        nearby = []
        if data['status'] == 'OK':
            for place in data['results'][:max_results]:
                place_lat = place['geometry']['location']['lat']
                place_lng = place['geometry']['location']['lng']
                distance = calculate_distance(lat, lng, place_lat, place_lng)
                
                # Only include if within radius and not the epicenter itself
                if 0 < distance <= radius_km:
                    nearby.append({
                        'name': place['name'],
                        'lat': place_lat,
                        'lng': place_lng,
                        'distance_km': round(distance, 1)
                    })
        
        # Sort by distance
        nearby.sort(key=lambda x: x['distance_km'])
        return nearby
        
    except Exception as e:
        print(f"Nearby places error (using fallback): {e}")
        return []  # Return empty, will use generated points

def generate_nearby_points(lat: float, lng: float, count: int = 8, radius_km: int = 100) -> List[Dict]:
    """
    Generate evenly distributed points around epicenter within radius
    Fallback when Google Places API fails
    """
    points = []
    earth_radius_km = 6371
    
    for i in range(count):
        angle = (360 / count) * i
        # Random distance between 30-90km
        import random
        distance = radius_km * (0.3 + random.random() * 0.6)
        
        angle_rad = math.radians(angle)
        dist_rad = distance / earth_radius_km
        
        lat_rad = math.radians(lat)
        lng_rad = math.radians(lng)
        
        new_lat_rad = math.asin(
            math.sin(lat_rad) * math.cos(dist_rad) +
            math.cos(lat_rad) * math.sin(dist_rad) * math.cos(angle_rad)
        )
        
        new_lng_rad = lng_rad + math.atan2(
            math.sin(angle_rad) * math.sin(dist_rad) * math.cos(lat_rad),
            math.cos(dist_rad) - math.sin(lat_rad) * math.sin(new_lat_rad)
        )
        
        points.append({
            'name': f'Affected Area {i + 1}',
            'lat': math.degrees(new_lat_rad),
            'lng': math.degrees(new_lng_rad),
            'distance_km': round(distance, 1)
        })
    
    return points

def calculate_map_bounds(lat: float, lng: float, radius_km: int = 100) -> Dict:
    """
    Calculate bounding box for map based on radius
    Returns: {north, south, east, west}
    """
    # Approximate degrees per km
    lat_degree_km = 111.0
    lng_degree_km = 111.0 * math.cos(math.radians(lat))
    
    lat_offset = radius_km / lat_degree_km
    lng_offset = radius_km / lng_degree_km
    
    return {
        'north': lat + lat_offset,
        'south': lat - lat_offset,
        'east': lng + lng_offset,
        'west': lng - lng_offset
    }

def process_disaster_location(location_data: Dict, disaster_type: str = None) -> Dict:
    """
    Main function to process location and generate map data
    OPTIMIZED: Fast execution with timeouts and fallbacks
    
    Args:
        location_data: {city, region, country, latitude, longitude}
        disaster_type: Type of disaster
    
    Returns:
        Complete map data with epicenter, nearby locations, and bounds
    """
    result = {
        'epicenter': None,
        'nearby_locations': [],
        'map_bounds': None,
        'radius_km': 100,
        'explanation': None
    }
    
    # Step 1: Get epicenter coordinates (FAST)
    if location_data.get('latitude') and location_data.get('longitude'):
        # Use provided coordinates (instant)
        lat = float(location_data['latitude'])
        lng = float(location_data['longitude'])
        name = ', '.join(filter(None, [
            location_data.get('city'),
            location_data.get('region'),
            location_data.get('country')
        ])) or 'Disaster Location'
        
        result['epicenter'] = {
            'lat': lat,
            'lng': lng,
            'name': name
        }
    else:
        # Geocode from city/region/country (3 second max)
        geocoded = geocode_location(
            location_data.get('city'),
            location_data.get('region'),
            location_data.get('country')
        )
        
        if geocoded:
            result['epicenter'] = {
                'lat': geocoded['lat'],
                'lng': geocoded['lng'],
                'name': geocoded['formatted_address']
            }
    
    # Step 2: Find nearby affected locations (FAST with fallback)
    if result['epicenter']:
        lat = result['epicenter']['lat']
        lng = result['epicenter']['lng']
        
        # Try Google Places API first (2 second timeout)
        nearby = find_nearby_cities(lat, lng, radius_km=100, max_results=8)
        
        # Fallback to generated points if API fails or returns nothing (instant)
        if not nearby:
            print("Using generated nearby points (instant fallback)")
            nearby = generate_nearby_points(lat, lng, count=8, radius_km=100)
        
        result['nearby_locations'] = nearby
        
        # Step 3: Calculate map bounds (instant)
        result['map_bounds'] = calculate_map_bounds(lat, lng, radius_km=100)
        
        # Step 4: Generate explanation
        result['explanation'] = (
            f"Map centered on {result['epicenter']['name']} with 100km radius. "
            f"Showing {len(nearby)} affected locations."
        )
    
    return result
