
async function fetchCountryData(countryName) {
    const response = await fetch(`https://restcountries.com/v3.1/name/${countryName}?fullText=true`);
    const data = await response.json();
    return data;
}

async function fetchFlag() {
    const countryName = document.getElementById("countryName").value;
    const countryData = await fetchCountryData(countryName);

    if (countryData && countryData.length > 0) {
        const flagUrl = countryData[0].flags.svg;
        document.getElementById("flagImage").src = flagUrl;
    } else {
        document.getElementById("flagImage").alt = "Country not found";
        document.getElementById("flagImage").src = "";
    }
}

function logCountryName() {
    const countryName = document.getElementById("countryName").value;
   
}

async function getRegionAndCapital(countryName) {
    const countryData = await fetchCountryData(countryName);
    
    if (countryData && countryData.length > 0) {
        const region = countryData[0].region;
        const capital = countryData[0].capital[0]; // Assuming the capital is an array and you want the first one
        const formattedCapital = capital.replace(/\s+/g, '_'); // Replace spaces with underscores
        return `${region}/${formattedCapital}`;
    } else {
        return "Country not found";
    }
}

async function fetchCapitalTime(regionCapital) {
    try {
        const response = await fetch(`https://timeapi.io/api/TimeZone/zone?timeZone=${regionCapital}`);
        const data = await response.json();
        return data.currentLocalTime;
    } catch (error) {
        console.error('Error fetching time:', error);
        return null;
    }
}

async function handleButtonClick() {
    const countryName = document.getElementById("countryName").value;
    logCountryName();
    fetchFlag();

    const regionAndCapital = await getRegionAndCapital(countryName);
    document.getElementById("regionCapital").textContent = regionAndCapital;

    
}


