use std::collections::{BTreeMap, HashSet};
use std::sync::OnceLock;

use serde::Deserialize;

use crate::structs::vec_license_plate_ats::{AtsCurrentPlate, AtsCurrentPlatesResponse};

// Generated from the game files by scripts/license-plates/gen_license_plates_ats.py.
const ATS_LICENSE_PLATES: &str = include_str!("../embeds/license_plates_ats.json");

const MAX_PLATE_TEXT_LEN: usize = 12;

#[derive(Deserialize)]
struct PlateCatalog {
    states: BTreeMap<String, PlateState>,
}

#[derive(Deserialize)]
struct PlateState {
    /// Characters the state's plate font can draw.
    chars: String,
    designs: Vec<PlateDesign>,
}

#[derive(Deserialize)]
struct PlateDesign {
    id: String,
    #[serde(rename = "type")]
    plate_type: String,
    /// Markup the game puts before and after the plate text for this design.
    prefix: String,
    suffix: String,
}

fn get_catalog() -> Option<&'static PlateCatalog> {
    static CATALOG: OnceLock<Option<PlateCatalog>> = OnceLock::new();
    CATALOG
        .get_or_init(|| serde_json::from_str(ATS_LICENSE_PLATES).ok())
        .as_ref()
}

/// The whole catalog (designs, backgrounds and font metrics) for the UI.
pub fn get_license_plates_catalog_ats() -> Option<serde_json::Value> {
    serde_json::from_str(ATS_LICENSE_PLATES).ok()
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PlateTarget {
    Truck,
    Trailer,
    Car,
}

impl PlateTarget {
    pub fn parse(value: &str) -> Option<PlateTarget> {
        match value {
            "truck" => Some(PlateTarget::Truck),
            "trailer" => Some(PlateTarget::Trailer),
            "car" => Some(PlateTarget::Car),
            _ => None,
        }
    }
}

/// Builds the `license_plate` value the game writes for a plate of `design`, e.g.
/// `<color value=FF40501C><align right=160><font xscale=1.2 yscale=1.2>ABC1234<offset vshift=5> </font></align>|arizona`.
/// Returns the value and the plate type that picks its background.
pub fn build_license_plate(state: &str, design_id: &str, text: &str) -> Option<(String, String)> {
    let catalog = get_catalog()?;
    let plate_state = catalog.states.get(state)?;
    let design = plate_state.designs.iter().find(|d| d.id == design_id)?;

    let char_count = text.chars().count();
    if text.trim().is_empty()
        || char_count > MAX_PLATE_TEXT_LEN
        || !text.chars().all(|ch| plate_state.chars.contains(ch))
    {
        return None;
    }

    let value = format!("{}{}{}|{}", design.prefix, text, design.suffix, state);
    return Some((value, design.plate_type.clone()));
}

/// Line range of the `<type> : <id> {` ... `}` unit.
fn find_unit(lines: &[String], id: &str) -> Option<(usize, usize)> {
    let header = format!(" : {} {{", id);
    let start = lines.iter().position(|line| line.ends_with(&header))?;
    let end = start + lines.iter().skip(start).position(|line| line == "}")?;
    return Some((start, end));
}

fn find_player(lines: &[String]) -> Option<(usize, usize)> {
    let start = lines
        .iter()
        .position(|line| line.starts_with("player : "))?;
    let end = start + lines.iter().skip(start).position(|line| line == "}")?;
    return Some((start, end));
}

fn unit_value(lines: &[String], unit: (usize, usize), key: &str) -> Option<String> {
    let prefix = format!("{}:", key);
    lines[unit.0..unit.1].iter().find_map(|line| {
        let value = line.trim().strip_prefix(&prefix)?.trim();
        return Some(value.to_string());
    })
}

fn unit_id(lines: &[String], unit: (usize, usize), key: &str) -> Option<String> {
    unit_value(lines, unit, key).filter(|id| !id.is_empty() && id != "null")
}

fn unit_list(lines: &[String], unit: (usize, usize), key: &str) -> Vec<String> {
    let prefix = format!("{}[", key);
    lines[unit.0..unit.1]
        .iter()
        .filter_map(|line| {
            let rest = line.trim().strip_prefix(&prefix)?;
            let (_, value) = rest.split_once("]:")?;
            let value = value.trim();
            return (!value.is_empty() && value != "null").then(|| value.to_string());
        })
        .collect()
}

/// `player_vehicles` units of the player: the assigned one first, then the owned ones.
fn player_vehicle_slots(lines: &[String], player: (usize, usize)) -> Vec<(usize, usize)> {
    let mut ids: Vec<String> = Vec::new();
    if let Some(assigned) = unit_id(lines, player, "assigned_vehicles") {
        ids.push(assigned);
    }
    for id in unit_list(lines, player, "my_vehicles") {
        if !ids.contains(&id) {
            ids.push(id);
        }
    }
    ids.iter().filter_map(|id| find_unit(lines, id)).collect()
}

/// Ids of the units whose plate is edited for `target`.
fn get_target_units(lines: &[String], target: PlateTarget) -> Vec<String> {
    let Some(player) = find_player(lines) else {
        return Vec::new();
    };
    let slots = player_vehicle_slots(lines, player);

    match target {
        PlateTarget::Truck | PlateTarget::Car => {
            let owned: HashSet<String> = unit_list(
                lines,
                player,
                if target == PlateTarget::Truck {
                    "trucks"
                } else {
                    "cars"
                },
            )
            .into_iter()
            .collect();
            let from_slots = slots
                .iter()
                .filter_map(|slot| unit_id(lines, *slot, "vehicle"))
                .find(|id| owned.contains(id));
            // Saves from before player_vehicles only know the assigned truck.
            let legacy = || {
                if target != PlateTarget::Truck {
                    return None;
                }
                unit_id(lines, player, "assigned_truck")
                    .or_else(|| unit_id(lines, player, "my_truck"))
            };
            from_slots.or_else(legacy).into_iter().collect()
        }
        PlateTarget::Trailer => {
            let first = slots
                .iter()
                .find_map(|slot| unit_id(lines, *slot, "trailer"))
                .or_else(|| unit_id(lines, player, "assigned_trailer"))
                .or_else(|| unit_id(lines, player, "my_trailer"));
            // Doubles and triples chain the rest of the set through slave_trailer.
            let mut chain: Vec<String> = Vec::new();
            let mut next = first;
            while let Some(id) = next {
                if chain.contains(&id) {
                    break;
                }
                next = find_unit(lines, &id).and_then(|unit| unit_id(lines, unit, "slave_trailer"));
                chain.push(id);
            }
            chain
        }
    }
}

/// Plate text without markup and its state, e.g. `ABC1234` and `arizona`.
fn parse_plate(value: &str) -> AtsCurrentPlate {
    let value = value.trim().trim_matches('"');
    let (text, state) = value.rsplit_once('|').unwrap_or((value, ""));
    let mut plain = String::new();
    let mut in_tag = false;
    for ch in text.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => plain.push(ch),
            _ => {}
        }
    }
    return AtsCurrentPlate {
        text: plain.trim().to_string(),
        state: state.trim_start_matches('_').to_string(),
    };
}

pub fn get_current_plates_ats(lines: &[String]) -> AtsCurrentPlatesResponse {
    let current = |target: PlateTarget| {
        let id = get_target_units(lines, target).into_iter().next()?;
        let unit = find_unit(lines, &id)?;
        return Some(parse_plate(
            &unit_value(lines, unit, "license_plate").unwrap_or_default(),
        ));
    };
    return AtsCurrentPlatesResponse {
        res: true,
        truck: current(PlateTarget::Truck),
        trailer: current(PlateTarget::Trailer),
        car: current(PlateTarget::Car),
    };
}

pub fn set_license_plate_ats(
    lines: &[String],
    target: PlateTarget,
    state: &str,
    design_id: &str,
    text: &str,
) -> Option<Vec<String>> {
    let (value, plate_type) = build_license_plate(state, design_id, text)?;
    let units = get_target_units(lines, target);
    if units.is_empty() {
        return None;
    }

    let mut result = lines.to_vec();
    for id in units {
        let (start, end) = find_unit(&result, &id)?;
        let mut written = false;
        for line in result[start..end].iter_mut() {
            let key = line.trim_start();
            if key.starts_with("license_plate:") {
                *line = format!(" license_plate: \"{}\"", value);
                written = true;
            } else if key.starts_with("license_plate_type:") {
                // The type picks the background, so a truck can wear e.g. a car design.
                *line = format!(" license_plate_type: {}", plate_type);
            }
        }
        if !written {
            return None;
        }
    }
    return Some(result);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save() -> Vec<String> {
        r#"SiiNunit
{
player : _nameless.p {
 assigned_vehicles: _nameless.pv1
 my_vehicles: 2
 my_vehicles[0]: _nameless.pv2
 my_vehicles[1]: _nameless.pv1
 trucks: 1
 trucks[0]: _nameless.truck
 cars: 1
 cars[0]: _nameless.car
 assigned_truck: null
 assigned_trailer: null
}

player_vehicles : _nameless.pv1 {
 vehicle: _nameless.car
 trailer: null
}

player_vehicles : _nameless.pv2 {
 vehicle: _nameless.truck
 trailer: _nameless.trailer1
}

vehicle : _nameless.car {
 fuel_relative: 1
 license_plate: "<color value=FF0601A2>SKATE300|idaho"
 license_plate_type: car
}

vehicle : _nameless.truck {
 license_plate: "AP96238|california"
 license_plate_type: truck
}

trailer : _nameless.trailer1 {
 slave_trailer: _nameless.trailer2
 license_plate: "<color value=FF6D2208>03633|nevada"
 license_plate_type: ""
}

trailer : _nameless.trailer2 {
 slave_trailer: null
 license_plate: "<color value=FF6D2208>03634|nevada"
 license_plate_type: trailer
}

vehicle : _nameless.other {
 license_plate: "UNTOUCHED|utah"
 license_plate_type: truck
}
}"#
        .lines()
        .map(|line| line.to_string())
        .collect()
    }

    fn line_of(lines: &[String], id: &str, key: &str) -> String {
        let unit = find_unit(lines, id).unwrap();
        unit_value(lines, unit, key).unwrap()
    }

    #[test]
    fn builds_plate_with_design_markup() {
        let (value, plate_type) = build_license_plate("arizona", "truck_0", "ABC1234").unwrap();
        assert_eq!(
            value,
            "<color value=FF40501C><align right=160><font xscale=1.2 yscale=1.2>ABC1234<offset vshift=5> </font></align>|arizona"
        );
        assert_eq!(plate_type, "truck");

        let (plain, _) = build_license_plate("california", "car_0", "7ABC123").unwrap();
        assert_eq!(plain, "7ABC123|california");
    }

    #[test]
    fn rejects_invalid_plates() {
        assert!(build_license_plate("arizona", "truck_0", "").is_none());
        assert!(build_license_plate("arizona", "truck_0", "   ").is_none());
        assert!(build_license_plate("arizona", "truck_0", "abc").is_none());
        assert!(build_license_plate("arizona", "truck_0", "AB\"|C").is_none());
        assert!(build_license_plate("arizona", "truck_0", "<color>").is_none());
        assert!(build_license_plate("arizona", "truck_0", "ABCDEFGHIJKLM").is_none());
        assert!(build_license_plate("arizona", "missing", "ABC").is_none());
        assert!(build_license_plate("bavaria", "truck_0", "ABC").is_none());
    }

    #[test]
    fn sets_truck_plate_and_type() {
        let result = set_license_plate_ats(
            &save(),
            PlateTarget::Truck,
            "california",
            "car_0",
            "7TRUCK1",
        )
        .unwrap();
        assert_eq!(
            line_of(&result, "_nameless.truck", "license_plate"),
            "\"7TRUCK1|california\""
        );
        assert_eq!(
            line_of(&result, "_nameless.truck", "license_plate_type"),
            "car"
        );
        assert_eq!(
            line_of(&result, "_nameless.car", "license_plate"),
            "\"<color value=FF0601A2>SKATE300|idaho\""
        );
        assert_eq!(
            line_of(&result, "_nameless.other", "license_plate"),
            "\"UNTOUCHED|utah\""
        );
        assert_eq!(result.len(), save().len());
    }

    #[test]
    fn sets_car_plate() {
        let result =
            set_license_plate_ats(&save(), PlateTarget::Car, "texas", "car_0", "ABC-1234").unwrap();
        assert_eq!(
            line_of(&result, "_nameless.car", "license_plate"),
            "\"ABC-1234|texas\""
        );
        assert_eq!(
            line_of(&result, "_nameless.truck", "license_plate"),
            "\"AP96238|california\""
        );
    }

    #[test]
    fn sets_every_trailer_of_the_chain() {
        let result = set_license_plate_ats(
            &save(),
            PlateTarget::Trailer,
            "california",
            "trailer_0",
            "4TR1234",
        )
        .unwrap();
        for id in ["_nameless.trailer1", "_nameless.trailer2"] {
            assert_eq!(
                line_of(&result, id, "license_plate"),
                "\"4TR1234|california\""
            );
            assert_eq!(line_of(&result, id, "license_plate_type"), "trailer");
        }
    }

    #[test]
    fn fails_without_target_vehicle() {
        let lines: Vec<String> = save()
            .into_iter()
            .filter(|line| !line.contains("cars[0]"))
            .collect();
        assert!(set_license_plate_ats(&lines, PlateTarget::Car, "texas", "car_0", "ABC").is_none());
    }

    #[test]
    fn reads_current_plates() {
        let current = get_current_plates_ats(&save());
        let truck = current.truck.unwrap();
        assert_eq!(
            (truck.text.as_str(), truck.state.as_str()),
            ("AP96238", "california")
        );
        let car = current.car.unwrap();
        assert_eq!(
            (car.text.as_str(), car.state.as_str()),
            ("SKATE300", "idaho")
        );
        let trailer = current.trailer.unwrap();
        assert_eq!(
            (trailer.text.as_str(), trailer.state.as_str()),
            ("03633", "nevada")
        );
    }
}
