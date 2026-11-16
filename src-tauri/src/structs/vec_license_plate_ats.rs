use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct AtsCurrentPlate {
    pub text: String,
    pub state: String,
}

#[derive(Serialize, Debug)]
pub struct AtsCurrentPlatesResponse {
    pub res: bool,
    pub truck: Option<AtsCurrentPlate>,
    pub trailer: Option<AtsCurrentPlate>,
    pub car: Option<AtsCurrentPlate>,
}

impl AtsCurrentPlatesResponse {
    pub fn failed() -> Self {
        AtsCurrentPlatesResponse {
            res: false,
            truck: None,
            trailer: None,
            car: None,
        }
    }
}
