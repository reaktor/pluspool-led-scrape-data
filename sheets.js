const PublicGoogleSheetsParser = require('public-google-sheets-parser');
const { ENDPOINTS } = require('./constants');

const fetchManualData = async () => {
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
  };

  let items = await parser.parse();

  let entries = items
    .filter((item) => item.timestamp)
    .map((item) => {
      return {
        date: new Date(parseInt(item.timestamp)),
        time: item.timestamp,
        enterococcus: item[headings.enterococcus],
        enteroGM: item[headings.enteroGM],
        fecalColiform: item[headings.fecalColiform],
        fcGM: item[headings.fcGM],
        fecalColiformGM: item[headings.fecalColiformGM],
        turbidity: item[headings.turbidity],
      };
    });

  console.log(entries);
  return entries;
};

fetchManualData();

module.exports = {
  fetchManualData,
};
