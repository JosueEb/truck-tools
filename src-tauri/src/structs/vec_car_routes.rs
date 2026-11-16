use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::structs::vec_routes::{CatalogCity, CatalogCompany, CityCompany};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CarCatalogJob {
    pub name: String,
    pub cargos: Vec<String>,
    pub vehicle_types: Vec<String>,
    pub express: bool,
    pub distance: [u32; 2],
    pub rating: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CarCatalogCargo {
    pub name: String,
    pub fragility: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CarCatalogModel {
    pub name: String,
    pub types: Vec<String>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct CarCatalog {
    pub jobs: HashMap<String, CarCatalogJob>,
    pub cargos: HashMap<String, CarCatalogCargo>,
    pub models: HashMap<String, CarCatalogModel>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CurrentCarJobInfo {
    pub job: String,
    pub cargo: Option<String>,
    pub source_city: String,
    pub source_company: String,
    pub target_city: String,
    pub target_company: String,
    pub distance_km: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SaveCarRouteDataResponse {
    pub res: bool,
    pub visited_cities: Vec<String>,
    /// Companies that take part in car jobs in this save, by city.
    pub companies_by_city: Vec<CityCompany>,
    /// Company cars the game itself offers in this save (model + color).
    pub cars: Vec<String>,
    /// Highest courier rating among the jobs the game offers in this save.
    pub courier_rating: f64,
    pub free_slots: u32,
    pub current_car_job: Option<CurrentCarJobInfo>,
    pub jobs: HashMap<String, CarCatalogJob>,
    pub cargos: HashMap<String, CarCatalogCargo>,
    pub models: HashMap<String, CarCatalogModel>,
    pub companies: HashMap<String, CatalogCompany>,
    pub cities: HashMap<String, CatalogCity>,
    pub positions: HashMap<String, [f64; 2]>,
}

impl SaveCarRouteDataResponse {
    pub fn failed() -> Self {
        SaveCarRouteDataResponse {
            res: false,
            visited_cities: Vec::new(),
            companies_by_city: Vec::new(),
            cars: Vec::new(),
            courier_rating: 0.0,
            free_slots: 0,
            current_car_job: None,
            jobs: HashMap::new(),
            cargos: HashMap::new(),
            models: HashMap::new(),
            companies: HashMap::new(),
            cities: HashMap::new(),
            positions: HashMap::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CarRoutePayload {
    pub source_city: String,
    pub source_company: String,
    pub target_city: String,
    pub target_company: String,
    pub job: String,
    pub cargo: Option<String>,
    pub company_car: String,
    pub distance_km: u32,
    pub urgency: u8,
    pub prio_cargo_handling: bool,
    pub prio_time: bool,
    pub prio_vehicle_appearance: bool,
    /// Saves the distance clamped to the job's range, for routes longer than any job allows.
    #[serde(default)]
    pub long_route_test: bool,
    pub game: Option<String>,
}
