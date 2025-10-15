const dataPath = "./data/";

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
let   quarterGeo  = {};
let   AllowList   = [];

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

	let featureGroup = L.featureGroup();
	districts = L.geoJSON(quarterData, {
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

			quarterGeo[feature.properties.qnr] = feature;

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
	districts.addTo(map);
	layerControl.addOverlay(featureGroup, "Stadtquartier");
	AllowList.push("Stadtquartier");
	// show it by default
	featureGroup.addTo(map);

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


	map.on("overlayadd", function(e) {
		// If the layer that's being changed is not allowed to be active w/ other layers...
		//if (!AllowList.includes(e.name)) {
		//	switchOverlay(e);
		//}
		// I wanted to only have 1 of the overlays active at a time but didnt have time
	});

	function onMapClick(e) {
        L.popup()
            .setLatLng(e.latlng)
            .setContent(`${e.latlng.toString()}`)
            .openOn(map);
    }
    map.on('click', onMapClick);
}





// do parsing shit
let maxQuarterOwnerPop = 0;
let maxQuarterDogPop   = 0;
function handleData(data, map, layerControl) {
	const quarterDogs = {};
	const quarterOwners = {};
	const id2Owner = {};

	data.forEach(row => {
		const quarter = row.quarter;
		const owner_id = row.owner_id;

		const dog = {
			owner_id: owner_id,
			breed: row.breed,
			breed_secondary: row.breed_secondary,
			category: row.category,
			sex: row.sex_dog,
			colour: row.colour,
			birthdate: row.birthdate
		};

		// owner object exists?
		if (!id2Owner[owner_id]) {
			id2Owner[owner_id] = {
				owner_id: owner_id,
				sex: row.sex,
				age: row.age,
				dogs: []
			};
		}

		id2Owner[owner_id].dogs.push(dog);

		// Init quarter data if needed
		if (!quarterDogs[quarter]) quarterDogs[quarter] = [];
		if (!quarterOwners[quarter]) quarterOwners[quarter] = new Set(); // avoid dup

		quarterDogs[quarter].push(dog);
		quarterOwners[quarter].add(owner_id);
	});

	// calculate max quarter populations for later
	Object.keys(quarterDogs).forEach(qnr => {
		if (quarterDogs[qnr].length <= maxQuarterDogPop) return;
		maxQuarterDogPop = quarterDogs[qnr].length;
	});

	Object.keys(quarterOwners).forEach(qnr => {
		if (quarterOwners[qnr].size <= maxQuarterOwnerPop) return;
		maxQuarterOwnerPop = quarterOwners[qnr].size;
	});


	console.log(quarterDogs, quarterOwners, id2Owner);

	// displays
	const overlays = {
		"Owner Sex": displayAvgSex(quarterOwners, id2Owner),
		"Dog Sex": displayAvgDogSex(quarterDogs),
		"Dog Catageory": displayAvgDogCat(quarterDogs)
	};

	for (const [label, layer] of Object.entries(overlays)) {
		layerControl.addOverlay(layer, label);
	}
}


// buncha functions for displaying data
function displayAvgAge(quarterDogs, quarterOwners, id2Owner) {
	return L.geoJSON(quarterData, {
		style: function (feature) {
			const qnr = feature.properties.qnr;
			return {
				color: `#222222`,
				weight: 2,
				opacity: 0.75,
				fillColor: hsvTohex(map01ToRange(1, 235, 285), 100, 100),
				fillOpacity: map01ToRange(1, 0.35, 0.75)
			};
		}
	});
}

// h should range 235-285, S = 100, V = 100
function displayAvgSex(quarterOwners, id2Owner) {
	const quarterScores = {};
	Object.keys(quarterOwners).forEach(qnr => {
		const owners = quarterOwners[qnr];
		const totalOwners = owners.size;

		if (totalOwners === 0) {
			quarterScores[qnr] = null;
			return;
		}

		// Count number of male owners
		let maleCount = 0;
		owners.forEach(id => {
			owner = id2Owner[id];
			if (owner.sex === 'm') {
				maleCount++;
			}
		});

		// Calculate score:
		const femaleCount = totalOwners - maleCount;
		const score = (femaleCount / totalOwners);

		quarterScores[qnr] = score;
	});

	return L.geoJSON(quarterData, {
		style: function (feature) {
			const qnr = feature.properties.qnr;
			const weight = quarterOwners[qnr].size / maxQuarterOwnerPop;
			return {
				color: `#222222`,
				weight: 2,
				opacity: 0.75,
				fillColor: hsvTohex(map01ToRange(quarterScores[qnr], 235, 285), 100, 100),
				fillOpacity: map01ToRange(weight, 0.35, 0.75)
			};
		},
		onEachFeature: function (feature, layer) {
			const qnr = feature.properties.qnr;
			const weight = quarterOwners[qnr].size / maxQuarterOwnerPop;
			layer.bindPopup(`${(weight * 100).toFixed(2)}% Female`);
		}
	});
}

function displayAvgDogSex(quarterDogs) {
	const quarterScores = {};
	Object.keys(quarterDogs).forEach(qnr => {
		const dogs = quarterDogs[qnr];
		const totalDogs = dogs.length; // fuck you JS

		if (totalDogs === 0) {
			quarterScores[qnr] = null;
			return;
		}

		// Count number of male dogs
		let maleCount = 0;
		dogs.forEach(dog => {
			if (dog.sex === 'm') {
				maleCount++;
			}
		});

		// Calculate score:
		const femaleCount = totalDogs - maleCount;
		const score = (femaleCount / totalDogs);

		quarterScores[qnr] = score;
	});

	return L.geoJSON(quarterData, {
		style: function (feature) {
			const qnr = feature.properties.qnr;
			const weight = quarterDogs[qnr].length / maxQuarterDogPop;
			return {
				color: `#222222`,
				weight: 2,
				opacity: 0.75,
				fillColor: hsvTohex(map01ToRange(quarterScores[qnr], 235, 285), 100, 100),
				fillOpacity: map01ToRange(weight, 0.35, 0.75)
			};
		},
		onEachFeature: function (feature, layer) {
			const qnr = feature.properties.qnr;
			const weight = quarterDogs[qnr].length / maxQuarterDogPop;
			layer.bindPopup(`${(weight * 100).toFixed(2)}% Female`);
		}
	});
}

function displayAvgDogCat(quarterDogs) {
	quarterCategory = {};
	Object.keys(quarterDogs).forEach(qnr => {
		const dogs = quarterDogs[qnr];
		const totalDogs = dogs.length;

		if (totalDogs === 0) {
			quarterCategory[qnr] = null;
			return;
		}

		// Count number of male dogs
		let k  = 0;
		let r1 = 0;
		let r2 = 0;
		dogs.forEach(dog => {
			if (dog.category === "K") {
				k++;
			} else if (dog.category == "I") {
				r1++;
			} else if (dog.category == "II") {
				r2++;
			}
		});

		quarterCategory[qnr] = {"K": k, "I": r1, "II": r2};
	});


	return L.geoJSON(quarterData, {
		style: function (feature) {
			const qnr = feature.properties.qnr;
			const len = quarterDogs[qnr].length;
			var cat = quarterCategory[qnr];

			let c1 = {"h": 0   / 360, "s": cat.K  / len, "v": 1};
			let c2 = {"h": 120 / 360, "s": cat.I  / len, "v": 1};
			let c3 = {"h": 235 / 360, "s": cat.II / len, "v": 1};

			let rgb1 = HSVtoRGB(c1);
			let rgb2 = HSVtoRGB(c2);
			let rgb3 = HSVtoRGB(c3);

			let r = Math.round((((rgb1.r + rgb2.r) / 2) + rgb3.r) / 2);
			let g = Math.round((((rgb1.g + rgb2.g) / 2) + rgb3.g) / 2);
			let b = Math.round((((rgb1.b + rgb2.b) / 2) + rgb3.b) / 2);

			let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
			return {
				color: `#222222`,
				weight: 2,
				opacity: 0.75,
				fillColor: hex,
				fillOpacity: map01ToRange(len / maxQuarterDogPop, 0.35, 0.75)
			};
		},
		onEachFeature: function (feature, layer) {
			const qnr = feature.properties.qnr;
			const len = quarterDogs[qnr].length;
			var cat = quarterCategory[qnr];

			let KW = ((cat.K  / len) * 100).toFixed(2);
			let IW = ((cat.I  / len) * 100).toFixed(2);
			let JW = ((cat.II / len) * 100).toFixed(2);

			layer.bindPopup(`${KW}% Kleinwüchsig.\n${IW}% Rassentypenliste I.\n${JW}% Rassentypenliste II`);
		}
	});
}




function map01ToRange(value01, min, max) {
    return min + value01 * (max - min);
}

/* https://stackoverflow.com/a/17243070
 * accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR 
 * h, s, v
*/
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/* accepts parameters
 * r  Object = {r:x, g:y, b:z}
 * OR 
 * r, g, b
*/
function RGBtoHSV(r, g, b) {
    if (arguments.length === 1) {
        g = r.g, b = r.b, r = r.r;
    }
    var max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
        case g: h = (b - r) + d * 2; h /= 6 * d; break;
        case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }

    return {
        h: h,
        s: s,
        v: v
    };
}

const toHex = x => {
	var hex = x.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
};

function hsvTohex(h, s, v) {
	var rgb = HSVtoRGB(h / 360, s / 100, v / 100);
	let hex = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
	return hex;
}
