const PublicGoogleSheetsParser = require('public-google-sheets-parser');

const fetchManualData = async () => {
  const spreadsheetId = '1DX2KE8NHpdEEO7ZwBEAjCc7BK1M43VoA';
  const parser = new PublicGoogleSheetsParser(spreadsheetId);

  let items = await parser.parse();

  let entries = items
    .filter((item) => item.timestamp)
    .map((item) => {
      console.log(item);
      return {
        date: new Date(parseInt(item.timestamp)),
        time: item.timestamp,
        enterococcus: item['Enterococcus (MPN/100mL)'],
        enteroGM: item['Entero (MPN/100mL) GM'],
        fecalColiform: item['Fecal Coliform (CFU/100mL)'] || null,
        fcGM: item['FC (CFU/100mL) GM'] || null,
        fecalColiformGM:
          item['Fecal Coliform (CFU/100mL) Geometric Mean'] || null,
        turbidity: item['Turbidity\n(NTU)'] || null,
      };
    });

  console.log(entries);
  return entries;
};

fetchManualData();

module.exports = {
  fetchManualData,
};
