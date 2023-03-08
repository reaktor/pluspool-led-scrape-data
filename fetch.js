const { ENDPOINTS, STREAMS } = require('./constants')
const PublicGoogleSheetsParser = require('public-google-sheets-parser');
const fetch = require('isomorphic-unfetch')
const { get } = require('datagarrison')
const { encode } = require('querystring')

const fetchNoaaData = () => {
  console.log('Fetching NOAA data');
  const { url, query } = ENDPOINTS.noaaCurrent;
  const source = `${url}?${encode(query)}`;

  return fetch(source, { method: 'GET' })
    .then((response) => {
      if (response.ok) return response.json();
      throw new Error(`Request rejected with status ${response.status}`);
    })
    .then((json) => {
      if (json.error && json.error.message) throw new Error(json.error.message);
      return json;
    })
    .then((json) => ({
      ...json,
      source,
      data: json.data?.map((datum) => ({ ...datum, t: `${datum.t} GMT` })),
    }));
};

const fetchPier17Data = () => {
  console.log('Fetching Pier 17 data');
  return get(STREAMS.pier17);
};

const fetchCentralParkData = () => {
  console.log('Fetching Central Park data');
  return get(STREAMS.centralPark);
};

const fetchManualData = async () => {
  console.log('Fetching manual data')
  const spreadsheetId = ENDPOINTS.googleSheetId;
  const parser = new PublicGoogleSheetsParser(spreadsheetId);


  // Column Headings
  const headings = {
    enterococcus: 'Enterococcus (MPN/100mL)',
    enteroGM: 'Entero (MPN/100mL) GM',
    fecalColiform: 'Fecal Coliform (CFU/100mL)',
    fcGM: 'FC (CFU/100mL) GM',
    fecalColiformGM: 'Fecal Coliform (CFU/100mL) Geometric Mean',
    turbidity: 'Turbidity\n(NTU)',
    rainfall: 'rainfall',
    rainfallPlus1Day: 'rainfallPlus1Day',
    rainfallPlus2Day: 'rainfallPlus2Day'
  };

  let items = await parser.parse();

  let entries = items
    .filter((item) => item.timestamp)
    .map((item) => {
     
      // return {
      //   timestamp: parseInt(item.timestamp),
      //   enterococcus: item[headings.enterococcus],
      //   enteroGM: item[headings.enteroGM],
      //   fecalColiform: item[headings.fecalColiform],
      //   fcGM: item[headings.fcGM],
      //   fecalColiformGM: item[headings.fecalColiformGM],
      //   turbidity: item[headings.turbidity],
      //   rainfall: item[headings.rainfall],
      //   rainfallPlus1Day: item[headings.rainfallPlus1Day],
      //   rainfallPlus2Day: item[headings.rainfallPlus2Day],
      // };

    

      return [
        parseInt(item.timestamp),
         item[headings.enterococcus],
         item[headings.enteroGM],
         item[headings.fecalColiform],
       item[headings.fcGM],
        item[headings.fecalColiformGM],
        item[headings.turbidity],
        item[headings.rainfall],
        item[headings.rainfallPlus1Day],
        item[headings.rainfallPlus2Day],
      ]

    });


  return {
    source: "https://docs.google.com/spreadsheets/d/" + ENDPOINTS.googleSheetId,
    header: ['Date_Time', 'enterococcus', 'enteroGM', 'fecalColiform', 'fcGM', 'fecalColiformGM', 'turbidity', 'rainfall', 'rainfallPlus1Day', 'rainfallPlus2Day'],
    samples: entries
  };
}

module.exports = {
  fetchNoaaData,
  fetchPier17Data,
  fetchCentralParkData,
  fetchManualData
};
