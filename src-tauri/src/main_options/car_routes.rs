use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::OnceLock;

use crate::main_options::routes::get_route_catalog;
use crate::structs::vec_car_routes::{
    CarCatalog, CarRoutePayload, CurrentCarJobInfo, SaveCarRouteDataResponse,
};
use crate::structs::vec_routes::CityCompany;

// Car jobs only exist in ATS.
const ATS_CAR_CATALOG: &str = include_str!("../embeds/car_catalog_ats.json");

// The dispatch market only reads the first 800 slots of the 1000-slot pool: in every save
// the game keeps slots 800-999 empty, and offers written there load but never show up.
const DISPATCH_VISIBLE_SLOTS: usize = 800;

// Sanity limit for long route test mode, which saves a shorter distance than the real one.
const MAX_TEST_ROUTE_KM: u32 = 5000;

pub fn get_car_catalog(game: &str) -> Option<&'static CarCatalog> {
    static ATS: OnceLock<Option<CarCatalog>> = OnceLock::new();

    match game {
        "ats" => ATS
            .get_or_init(|| serde_json::from_str(ATS_CAR_CATALOG).ok())
            .as_ref(),
        _ => None,
    }
}

/// One `car_offer_data` unit of the save.
struct CarOffer {
    id: String,
    pool_index: usize,
    start: usize,
    end: usize,
    source: String,
    target: String,
    expiration_time: Option<u64>,
    job: String,
    company_car: String,
}

impl CarOffer {
    fn is_empty(&self) -> bool {
        self.source.is_empty() || self.target.is_empty() || self.job == "null"
    }

    fn is_visible(&self) -> bool {
        self.pool_index < DISPATCH_VISIBLE_SLOTS
    }
}

fn is_safe_sii_token(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
}

fn unquote(value: &str) -> String {
    value.trim().trim_matches('"').to_string()
}

/// Offers listed by `car_job_generator`, which is the pool the dispatch screen reads, in
/// pool order.
fn parse_car_offers(lines: &[String]) -> Vec<CarOffer> {
    let Some(generator) = lines
        .iter()
        .position(|line| line.starts_with("car_job_generator :"))
    else {
        return Vec::new();
    };
    let pool: HashMap<String, usize> = lines
        .iter()
        .skip(generator + 1)
        .take_while(|line| line.trim() != "}")
        .filter_map(|line| {
            let (key, id) = line.trim().split_once(':')?;
            let index = key.strip_prefix("car_offers[")?.strip_suffix(']')?.parse().ok()?;
            Some((id.trim().to_string(), index))
        })
        .collect();

    let mut offers = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let Some(id) = lines[i]
            .strip_prefix("car_offer_data : ")
            .and_then(|rest| rest.strip_suffix(" {"))
        else {
            i += 1;
            continue;
        };
        let start = i;
        let mut offer = CarOffer {
            id: id.to_string(),
            pool_index: 0,
            start,
            end: start,
            source: String::new(),
            target: String::new(),
            expiration_time: None,
            job: String::new(),
            company_car: String::new(),
        };
        i += 1;
        while i < lines.len() && lines[i].trim() != "}" {
            if let Some((key, value)) = lines[i].trim().split_once(':') {
                match key {
                    "source" => offer.source = unquote(value),
                    "target" => offer.target = unquote(value),
                    "expiration_time" => offer.expiration_time = value.trim().parse().ok(),
                    "job" => offer.job = value.trim().to_string(),
                    "company_car" => offer.company_car = unquote(value),
                    _ => {}
                }
            }
            i += 1;
        }
        offer.end = i;
        if let Some(index) = pool.get(&offer.id) {
            offer.pool_index = *index;
            offers.push(offer);
        }
        i += 1;
    }
    offers.sort_by_key(|offer| offer.pool_index);
    offers
}

/// `game_time` of the economy unit; other units have their own `game_time` fields.
fn get_game_time(lines: &[String]) -> Option<u64> {
    let economy = lines.iter().position(|line| line.starts_with("economy :"))?;
    lines
        .iter()
        .skip(economy + 1)
        .take_while(|line| line.trim() != "}")
        .find_map(|line| line.trim().strip_prefix("game_time:"))
        .and_then(|value| value.trim().parse().ok())
}

fn get_visited_cities(lines: &[String]) -> Vec<String> {
    let cities: BTreeSet<String> = lines
        .iter()
        .filter(|line| line.starts_with(" visited_cities["))
        .filter_map(|line| line.split_once(':').map(|(_, city)| unquote(city)))
        .filter(|city| !city.is_empty())
        .collect();
    cities.into_iter().collect()
}

fn split_company_key(key: &str) -> Option<(&str, &str)> {
    let key = key.strip_prefix("company.volatile.").unwrap_or(key);
    let (company, city) = key.split_once('.')?;
    (is_safe_sii_token(company) && is_safe_sii_token(city)).then_some((company, city))
}

fn get_current_car_job(lines: &[String]) -> Option<CurrentCarJobInfo> {
    let player = lines.iter().position(|line| line.starts_with("player :"))?;
    let job_id = lines
        .iter()
        .skip(player + 1)
        .take_while(|line| line.trim() != "}")
        .find_map(|line| line.trim().strip_prefix("current_car_job:"))
        .map(|value| value.trim().to_string())
        .filter(|value| value != "null")?;

    let header = format!("player_car_job : {} {{", job_id);
    let start = lines.iter().position(|line| line.trim() == header)?;
    let fields: HashMap<String, String> = lines
        .iter()
        .skip(start + 1)
        .take_while(|line| line.trim() != "}")
        .filter_map(|line| {
            let (key, value) = line.trim().split_once(':')?;
            Some((key.to_string(), value.trim().to_string()))
        })
        .collect();

    let (source_company, source_city) = split_company_key(fields.get("source_company")?)?;
    let (target_company, target_city) = split_company_key(fields.get("target_company")?)?;
    Some(CurrentCarJobInfo {
        job: fields.get("job")?.trim_start_matches("car_job.").to_string(),
        cargo: fields
            .get("cargo")
            .filter(|cargo| cargo.as_str() != "null")
            .map(|cargo| cargo.trim_start_matches("car_cargo.").to_string()),
        source_city: source_city.to_string(),
        source_company: source_company.to_string(),
        target_city: target_city.to_string(),
        target_company: target_company.to_string(),
        distance_km: fields
            .get("planned_distance")
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
    })
}

pub fn get_save_car_route_data(lines: &Vec<String>, game: &str) -> SaveCarRouteDataResponse {
    let Some(catalog) = get_car_catalog(game) else {
        return SaveCarRouteDataResponse::failed();
    };
    let offers = parse_car_offers(lines);
    if offers.is_empty() {
        return SaveCarRouteDataResponse::failed();
    }

    // Companies, cars and jobs the game itself uses for car jobs in this save.
    let mut companies: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut cars: BTreeSet<String> = BTreeSet::new();
    let mut courier_rating: f64 = 0.0;
    for offer in offers
        .iter()
        .filter(|offer| offer.is_visible() && !offer.is_empty())
    {
        for key in [&offer.source, &offer.target] {
            if let Some((company, city)) = split_company_key(key) {
                companies
                    .entry(city.to_string())
                    .or_default()
                    .insert(company.to_string());
            }
        }
        if is_safe_sii_token(&offer.company_car) {
            cars.insert(offer.company_car.clone());
        }
        if let Some(job) = catalog.jobs.get(offer.job.trim_start_matches("car_job.")) {
            courier_rating = courier_rating.max(job.rating);
        }
    }

    let route_catalog = get_route_catalog(game);
    SaveCarRouteDataResponse {
        res: true,
        visited_cities: get_visited_cities(lines),
        companies_by_city: companies
            .into_iter()
            .map(|(city, companies)| CityCompany {
                city,
                companies: companies.into_iter().collect(),
            })
            .collect(),
        cars: cars.into_iter().collect(),
        courier_rating,
        free_slots: offers
            .iter()
            .filter(|offer| offer.is_visible() && offer.is_empty())
            .count() as u32,
        current_car_job: get_current_car_job(lines),
        jobs: catalog.jobs.clone(),
        cargos: catalog.cargos.clone(),
        models: catalog.models.clone(),
        companies: route_catalog
            .map(|data| data.companies.clone())
            .unwrap_or_default(),
        cities: route_catalog
            .map(|data| data.cities.clone())
            .unwrap_or_default(),
        positions: route_catalog
            .map(|data| {
                data.places
                    .iter()
                    .map(|(key, place)| (key.clone(), [place.x, place.y]))
                    .collect()
            })
            .unwrap_or_default(),
    }
}

/// Model of a company car: "ford_bronco_24_azure_gray" -> "ford_bronco_24".
fn car_model<'a>(catalog: &'a CarCatalog, company_car: &str) -> Option<&'a str> {
    catalog
        .models
        .keys()
        .filter(|model| company_car.starts_with(&format!("{}_", model)))
        .max_by_key(|model| model.len())
        .map(|model| model.as_str())
}

/// Writes the route as a car job offer, reusing an empty slot of the dispatch pool (or the
/// one that expires first). The player accepts it in the game's car dispatch screen.
pub fn set_custom_car_route(
    lines: &Vec<String>,
    payload: &CarRoutePayload,
    game: &str,
) -> Option<Vec<String>> {
    let catalog = get_car_catalog(game)?;
    let job = catalog.jobs.get(&payload.job)?;

    if !is_safe_sii_token(&payload.job)
        || !is_safe_sii_token(&payload.company_car)
        || payload.urgency > 2
        || payload.distance_km == 0
        || payload.distance_km > MAX_TEST_ROUTE_KM
        // The game drops offers outside the job's company_distance range: every offer it
        // generates stays inside it. Long route test mode saves a distance inside the range
        // for a longer real route instead.
        || (!payload.long_route_test
            && (payload.distance_km < job.distance[0] || payload.distance_km > job.distance[1]))
        || (payload.source_city == payload.target_city
            && payload.source_company == payload.target_company)
    {
        return None;
    }

    // Delivery jobs carry one of the job's cargos; driving jobs only move the car.
    let is_delivery = !job.cargos.is_empty();
    let cargo = match (is_delivery, payload.cargo.as_deref()) {
        (true, Some(cargo)) if job.cargos.iter().any(|c| c == cargo) => {
            format!("car_cargo.{}", cargo)
        }
        (false, None) => "null".to_string(),
        _ => return None,
    };

    // The car must be one the game already offers in this save and fit the job.
    let offers = parse_car_offers(lines);
    if !offers.iter().any(|offer| {
        offer.is_visible() && !offer.is_empty() && offer.company_car == payload.company_car
    })
    {
        return None;
    }
    let model = catalog.models.get(car_model(catalog, &payload.company_car)?)?;
    if !model.types.iter().any(|kind| job.vehicle_types.contains(kind)) {
        return None;
    }

    // Both companies must exist in this save. Live offers come and go, so they are only
    // used to build the list the UI shows, not to validate a route.
    let source_key = format!("{}.{}", payload.source_company, payload.source_city);
    let target_key = format!("{}.{}", payload.target_company, payload.target_city);
    let company_exists = |key: &str| {
        let header = format!("company : company.volatile.{} {{", key);
        lines.iter().any(|line| line.trim() == header)
    };
    if !is_safe_sii_token(&source_key)
        || !is_safe_sii_token(&target_key)
        || !company_exists(&source_key)
        || !company_exists(&target_key)
    {
        return None;
    }

    // An empty slot the dispatch market reads, or else the visible offer that expires first.
    let visible: Vec<&CarOffer> = offers.iter().filter(|offer| offer.is_visible()).collect();
    let slot = visible
        .iter()
        .find(|offer| offer.is_empty())
        .or_else(|| {
            visible
                .iter()
                .min_by_key(|offer| offer.expiration_time.unwrap_or(0))
        })?;

    let saved_distance_km = payload
        .distance_km
        .clamp(job.distance[0], job.distance[1]);
    let game_time = get_game_time(lines)?;
    // The real distance sets the deadline, so a long test route still has time to finish.
    let expiration_time = game_time.saturating_add(1500 + payload.distance_km as u64 * 2);

    let new_offer = vec![
        format!("car_offer_data : {} {{", slot.id),
        format!(" source: \"{}\"", source_key),
        format!(" target: \"{}\"", target_key),
        format!(" expiration_time: {}", expiration_time),
        format!(" urgency: {}", payload.urgency),
        format!(
            " job_type: {}",
            if is_delivery { "delivery" } else { "driving" }
        ),
        format!(" shortest_distance_km: {}", saved_distance_km),
        " ferry_time: 0".to_string(),
        " ferry_price: 0".to_string(),
        format!(" job: car_job.{}", payload.job),
        format!(" cargo: {}", cargo),
        format!(" company_car: {}", payload.company_car),
        format!(" units_count: {}", if is_delivery { 1 } else { 0 }),
        format!(
            " customer_prio_cargo_handling: {}",
            payload.prio_cargo_handling
        ),
        format!(" customer_prio_time: {}", payload.prio_time),
        format!(
            " customer_prio_vehicle_appearance: {}",
            payload.prio_vehicle_appearance
        ),
        "}".to_string(),
    ];

    let mut result = lines.clone();
    result.splice(slot.start..=slot.end, new_offer);
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save() -> Vec<String> {
        [
            "economy : _nameless.1 {",
            " game_time: 1000",
            " visited_cities: 1",
            " visited_cities[0]: phoenix",
            "}",
            "player : _nameless.2 {",
            " current_car_job: null",
            "}",
            "company : company.volatile.chm_che_plnt.phoenix {",
            "}",
            "company : company.volatile.wac_air_svc.g_canyon_vlg {",
            "}",
            "car_job_generator : _nameless.3 {",
            " car_offers: 2",
            " car_offers[0]: _nameless.10",
            " car_offers[1]: _nameless.11",
            "}",
            "car_offer_data : _nameless.10 {",
            " source: \"chm_che_plnt.phoenix\"",
            " target: \"wac_air_svc.g_canyon_vlg\"",
            " expiration_time: 2000",
            " urgency: 0",
            " job_type: delivery",
            " shortest_distance_km: 342",
            " ferry_time: 0",
            " ferry_price: 0",
            " job: car_job.packpro_0",
            " cargo: car_cargo.pack_proto",
            " company_car: ford_mustang_67_white",
            " units_count: 1",
            " customer_prio_cargo_handling: true",
            " customer_prio_time: false",
            " customer_prio_vehicle_appearance: false",
            "}",
            "car_offer_data : _nameless.11 {",
            " source: \"\"",
            " target: \"\"",
            " expiration_time: nil",
            " urgency: nil",
            " job_type: delivery",
            " shortest_distance_km: 0",
            " ferry_time: 0",
            " ferry_price: 0",
            " job: null",
            " cargo: null",
            " company_car: \"\"",
            " units_count: 0",
            " customer_prio_cargo_handling: false",
            " customer_prio_time: false",
            " customer_prio_vehicle_appearance: false",
            "}",
        ]
        .iter()
        .map(|line| line.to_string())
        .collect()
    }

    fn payload() -> CarRoutePayload {
        CarRoutePayload {
            source_city: "g_canyon_vlg".to_string(),
            source_company: "wac_air_svc".to_string(),
            target_city: "phoenix".to_string(),
            target_company: "chm_che_plnt".to_string(),
            job: "psmpl_0".to_string(),
            cargo: Some("prod_smpl".to_string()),
            company_car: "ford_mustang_67_white".to_string(),
            distance_km: 342,
            urgency: 0,
            prio_cargo_handling: false,
            prio_time: true,
            prio_vehicle_appearance: false,
            long_route_test: false,
            game: Some("ats".to_string()),
        }
    }

    #[test]
    fn reads_car_route_data() {
        let data = get_save_car_route_data(&save(), "ats");
        assert!(data.res);
        assert_eq!(data.free_slots, 1);
        assert_eq!(data.cars, vec!["ford_mustang_67_white"]);
        assert_eq!(data.companies_by_city.len(), 2);
        assert!(data.current_car_job.is_none());
    }

    #[test]
    fn writes_route_into_empty_slot() {
        let lines = save();
        let result = set_custom_car_route(&lines, &payload(), "ats").expect("route written");
        assert_eq!(result.len(), lines.len());
        let start = result
            .iter()
            .position(|line| line == "car_offer_data : _nameless.11 {")
            .unwrap();
        assert_eq!(result[start + 1], " source: \"wac_air_svc.g_canyon_vlg\"");
        assert_eq!(result[start + 3], " expiration_time: 3184");
        assert_eq!(result[start + 9], " job: car_job.psmpl_0");
        assert_eq!(result[start + 10], " cargo: car_cargo.prod_smpl");
        assert_eq!(result[start + 16], "}");
        // The live offer is untouched.
        assert!(result.contains(&" job: car_job.packpro_0".to_string()));
    }

    #[test]
    fn ignores_slots_the_dispatch_market_does_not_read() {
        // Move the empty slot past the visible part of the pool.
        let lines: Vec<String> = save()
            .into_iter()
            .map(|line| line.replace("car_offers[1]:", "car_offers[850]:"))
            .collect();
        assert_eq!(get_save_car_route_data(&lines, "ats").free_slots, 0);

        // With no visible empty slot, the visible offer that expires first is replaced.
        let result = set_custom_car_route(&lines, &payload(), "ats").expect("route written");
        let start = result
            .iter()
            .position(|line| line == "car_offer_data : _nameless.10 {")
            .unwrap();
        assert_eq!(result[start + 1], " source: \"wac_air_svc.g_canyon_vlg\"");
        let hidden = result
            .iter()
            .position(|line| line == "car_offer_data : _nameless.11 {")
            .unwrap();
        assert_eq!(result[hidden + 1], " source: \"\"");
    }

    #[test]
    fn long_route_test_saves_distance_inside_job_range() {
        let mut route = payload();
        route.distance_km = 1335;
        route.long_route_test = true;
        let result = set_custom_car_route(&save(), &route, "ats").expect("route written");
        let start = result
            .iter()
            .position(|line| line == "car_offer_data : _nameless.11 {")
            .unwrap();
        // psmpl_0 allows 40-450 km; the deadline still uses the real 1335 km.
        assert_eq!(result[start + 6], " shortest_distance_km: 450");
        assert_eq!(result[start + 3], " expiration_time: 5170");
    }

    #[test]
    fn rejects_car_the_job_does_not_accept() {
        let mut route = payload();
        route.job = "jockey_0".to_string();
        route.cargo = None;
        // Car jockey jobs don't accept muscle cars such as the Mustang.
        assert!(set_custom_car_route(&save(), &route, "ats").is_none());
    }

    #[test]
    fn rejects_invalid_routes() {
        let mut wrong_cargo = payload();
        wrong_cargo.cargo = Some("pack_proto".to_string());
        assert!(set_custom_car_route(&save(), &wrong_cargo, "ats").is_none());

        let mut unknown_car = payload();
        unknown_car.company_car = "ford_bronco_24_red".to_string();
        assert!(set_custom_car_route(&save(), &unknown_car, "ats").is_none());

        let mut too_far = payload();
        too_far.distance_km = 1335;
        assert!(set_custom_car_route(&save(), &too_far, "ats").is_none());

        let mut unknown_company = payload();
        unknown_company.target_company = "unknown".to_string();
        assert!(set_custom_car_route(&save(), &unknown_company, "ats").is_none());

        assert!(set_custom_car_route(&save(), &payload(), "ets2").is_none());
    }
}
