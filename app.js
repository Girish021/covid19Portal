const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initilizeOfServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3001, () => {
      console.log("Server starting at https://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
  }
};
initilizeOfServer();

const authuntication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "girish", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        // console.log(payload);
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  //  const encryptedPaaword = bcrypt.hash(password,10);
  const selectedCovid19User = `SELECT * FROM user WHERE username = "${username}";`;
  const dbUser = await db.get(selectedCovid19User);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPaawordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPaawordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "girish");

      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const stateResponseOfServer = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
app.get("/states/", authuntication, async (request, response) => {
  const selectStates = `SELECT   *FROM  state; `;
  const stateArray = await db.all(selectStates);
  response.send(
    stateArray.map((eachArray) => stateResponseOfServer(eachArray))
  );
});

app.get("/states/:stateId/", authuntication, async (request, response) => {
  const { stateId } = request.params;
  const getRequiredStateId = `SELECT state_id,state_name,population 
                           FROM state 
                            WHERE state_id = ${stateId};`;
  const state = await db.get(getRequiredStateId);
  // console.log(state);
  response.send({
    stateId: state["state_id"],
    stateName: state["state_name"],
    population: state["population"],
  });
});

app.post("/districts/", authuntication, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
  INSERT INTO
    district (state_id, district_name, cases, cured, active, deaths)
  VALUES
    (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`;
  const user = await db.run(postDistrictQuery);

  console.log(user);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authuntication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictsQuery = `
    SELECT
      *
    FROM
     district
    WHERE
      district_id = ${districtId};`;
    const district = await db.get(getDistrictsQuery);
    response.send(convertDistrictDbObjectToResponseObject(district));
  }
);

app.delete(
  "/districts/:districtId/",
  authuntication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM
                                     district
                                       WHERE
                           district_id = ${districtId}`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId/",
  authuntication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
  UPDATE
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active}, 
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};
  `;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authuntication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
