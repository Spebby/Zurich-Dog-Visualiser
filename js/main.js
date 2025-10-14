const dataPath = "./data/";

function capitalise(str) {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}

async function fetchData(path) {
	const response = await fetch(path);
	return await response.json();
}


const dogData = `${dataPath}20170308hundehalter.csv`;
const geoData = `${dataPath}stzh.adm_statistische_quartiere_map.geojson`;
const centre = L.latLng(47.37815, 8.541079,);
const bndSW = L.latLng(47.31, 8.44);
const bndNE = L.latLng(47.44, 8.63);
let   quarterData = null;
let   quarterDict = {};

fetchData(geoData).then(data => {
	quarterData = data;
	main();
});

function main() {
	const map = L.map('map', {
		inertia: true,
		minZoom: 13,
		maxBounds: L.latLngBounds(bndSW, bndNE),
		maxBoundsViscosity: 1.0,
	}).setView(centre, 13);

	const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 16,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);

	var osmHOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 16,
    attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France'});


	const baseMaps = {
		"OpenStreetMap": osm,
		"OpenStreetMap.HOT": osmHOT
	};
	var layerControl = L.control.layers(baseMaps, {}).addTo(map);

	// Parse CSV
	Papa.parse(dogData, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function (results) {
			const data = results.data;
			console.log("Parsed dog CSV:", data);
			handleData(data, map, layerControl);
		},
		error: function (err) {
			console.error("Error loading CSV:", err);
		}
    });

	fetchData(geoData).then(data => {
		let featureGroup = L.featureGroup();
		districts = L.geoJSON(data, {
			style: function (feature) {
				return {
					color: "#0000FF",
					weight: 2,
					opacity: 0.75,
					fillColor: "#FFFFFF",
					fillOpacity: 0.2
				};
			},
			onEachFeature: function (feature, layer) {
				const center = layer.getBounds().getCenter();
				const qname = feature.properties.qname;

				quarterDict[feature.properties.qnr] = feature;

				let labelMarker = L.marker(center, {
					icon: L.divIcon({
					className: 'location',
					html: qname,
					iconSize: [100, 30],
					iconAnchor: [50, 15],
					interactive: false
				})});
				featureGroup.addLayer(labelMarker);
				if (feature.properties.kname) {
					layer.bindPopup(feature.properties.kname);
				}
			}
		});
		//featureGroup.addLayer(districts);
		districts.addTo(map);
		layerControl.addOverlay(featureGroup, "Stadtquartier");
		// show it by default
		featureGroup.addTo(map);
	}).catch(error => {
		console.error('Error loading GeoJSON:', error);
	});

	function onMapClick(e) {
        L.popup()
            .setLatLng(e.latlng)
            .setContent(`${e.latlng.toString()}`)
            .openOn(map);
    }

    map.on('click', onMapClick);
}

function handleData(data, map, layerControl) {
	const quarterScores = {};

	data.forEach(row => {
		const score = getScore(row);
		const quarter = row.quarter;

		if (!quarterScores[quarter]) {
			quarterScores[quarter] = 0;
		}
		quarterScores[quarter] += score;
	});

	console.log("Quarter scores:", quarterScores);
}

function getScore(row) {
	let score = 0;

	switch (row.category) {
		case 'K': score += 3; break;
		case 'I': score += 2; break;
		default: score += 1;
	}

	switch (row.age) {
		case '61-70': score += 2; break;
		case '71-80': score += 3; break;
		default: score += 1;
	}

	score += (row.sex === 'm') ? 2 : 1;

	return score;
}

