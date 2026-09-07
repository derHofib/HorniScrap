/**
 * HORNBACH Filialverzeichnis mit Geokoordinaten für GPS- & Umkreissuche.
 */

export const HORNBACH_STORES = [
  // ── Berlin & Brandenburg ───────────────────────────────────────────────
  { id: '609', name: 'Berlin-Mariendorf', address: 'Großbeerenstraße 132', postal: '12107', city: 'Berlin', lat: 52.4385, lng: 13.3768 },
  { id: '616', name: 'Berlin-Neukölln', address: 'Grenzallee 46', postal: '12057', city: 'Berlin', lat: 52.4682, lng: 13.4561 },
  { id: '617', name: 'Berlin-Bohnsdorf', address: 'Grünbergallee 279', postal: '12526', city: 'Berlin', lat: 52.3985, lng: 13.5412 },
  { id: '608', name: 'Velten', address: 'Berliner Straße 12', postal: '16727', city: 'Velten', lat: 52.6841, lng: 13.1895 },
  { id: '611', name: 'Potsdam-Marquardt', address: 'Fahrländer Chaussee 1', postal: '14476', city: 'Potsdam', lat: 52.4632, lng: 12.9641 },
  { id: '618', name: 'Ludwigsfelde', address: 'Brandenburger Tor 1', postal: '14974', city: 'Ludwigsfelde', lat: 52.3021, lng: 13.2541 },

  // ── Hamburg & Norddeutschland ──────────────────────────────────────────
  { id: '310', name: 'Hamburg-Eidelstedt', address: 'Holsteiner Chaussee 290', postal: '22457', city: 'Hamburg', lat: 53.6261, lng: 9.8972 },
  { id: '311', name: 'Bremen-Duckwitzstraße', address: 'Duckwitzstraße 61', postal: '28199', city: 'Bremen', lat: 53.0562, lng: 8.7841 },
  { id: '312', name: 'Hannover-Altwarmbüchen', address: 'Hannoversche Str. 90', postal: '30916', city: 'Isernhagen', lat: 52.4285, lng: 9.8541 },
  { id: '313', name: 'Braunschweig', address: 'Christian-Pommer-Str. 20', postal: '38112', city: 'Braunschweig', lat: 52.3012, lng: 10.5142 },
  { id: '314', name: 'Kiel', address: 'Gutenbergstraße 82', postal: '24118', city: 'Kiel', lat: 54.3312, lng: 10.1142 },
  { id: '315', name: 'Lübeck', address: 'Bei der Gasanstalt 3', postal: '23560', city: 'Lübeck', lat: 53.8451, lng: 10.6841 },

  // ── Nordrhein-Westfalen (Ruhrgebiet & Rheinland) ───────────────────────
  { id: '410', name: 'Essen-Frillendorf', address: 'Am Schönscheidt 1', postal: '45307', city: 'Essen', lat: 51.4651, lng: 7.0541 },
  { id: '411', name: 'Dortmund-Nord', address: 'Bornstraße 160', postal: '44145', city: 'Dortmund', lat: 51.5285, lng: 7.4612 },
  { id: '412', name: 'Gelsenkirchen', address: 'Grothusstraße 42', postal: '45883', city: 'Gelsenkirchen', lat: 51.5212, lng: 7.0784 },
  { id: '413', name: 'Duisburg', address: 'Neumühler Str. 20', postal: '47137', city: 'Duisburg', lat: 51.4782, lng: 6.7841 },
  { id: '414', name: 'Oberhausen', address: 'Mülheimer Str. 25', postal: '46049', city: 'Oberhausen', lat: 51.4682, lng: 6.8641 },
  { id: '415', name: 'Köln-Poll', address: 'Rolshover Str. 200', postal: '51105', city: 'Köln', lat: 50.9142, lng: 7.0012 },
  { id: '416', name: 'Wuppertal', address: 'Märkische Str. 12', postal: '42281', city: 'Wuppertal', lat: 51.2785, lng: 7.2142 },
  { id: '417', name: 'Bochum', address: 'Herner Str. 295', postal: '44809', city: 'Bochum', lat: 51.5012, lng: 7.2041 },
  { id: '418', name: 'Mönchengladbach', address: 'Krefelder Str. 500', postal: '41066', city: 'Mönchengladbach', lat: 51.2142, lng: 6.4682 },
  { id: '419', name: 'Münster', address: 'Weseler Str. 600', postal: '48163', city: 'Münster', lat: 51.9312, lng: 7.5841 },
  { id: '420', name: 'Bielefeld', address: 'Herforder Str. 400', postal: '33609', city: 'Bielefeld', lat: 52.0451, lng: 8.5641 },

  // ── Hessen & Rhein-Main ───────────────────────────────────────────────
  { id: '510', name: 'Frankfurt-Niedereschbach', address: 'Züricher Str. 11', postal: '60437', city: 'Frankfurt am Main', lat: 50.1982, lng: 8.6641 },
  { id: '511', name: 'Hanau', address: 'Oderstraße 20', postal: '63452', city: 'Hanau', lat: 50.1382, lng: 8.9412 },
  { id: '512', name: 'Wiesbaden', address: 'Mainzer Str. 130', postal: '65189', city: 'Wiesbaden', lat: 50.0582, lng: 8.2541 },
  { id: '513', name: 'Darmstadt', address: 'Otto-Hesse-Str. 19', postal: '64293', city: 'Darmstadt', lat: 49.8785, lng: 8.6241 },
  { id: '514', name: 'Kassel', address: 'Dresdener Str. 1', postal: '34125', city: 'Kassel', lat: 51.3142, lng: 9.5212 },

  // ── Baden-Württemberg ─────────────────────────────────────────────────
  { id: '520', name: 'Stuttgart-Giebel', address: 'Flachtstraße 30', postal: '70499', city: 'Stuttgart', lat: 48.8142, lng: 9.0912 },
  { id: '521', name: 'Karlsruhe', address: 'Durmersheimer Str. 157', postal: '76189', city: 'Karlsruhe', lat: 48.9985, lng: 8.3541 },
  { id: '522', name: 'Mannheim', address: 'Spreewaldallee 40', postal: '68309', city: 'Mannheim', lat: 49.5085, lng: 8.5241 },
  { id: '523', name: 'Freiburg', address: 'Mitscherlichstraße 1', postal: '79108', city: 'Freiburg', lat: 48.0212, lng: 7.8541 },
  { id: '524', name: 'Ulm', address: 'Blaubeurer Str. 100', postal: '89077', city: 'Ulm', lat: 48.4012, lng: 9.9641 },
  { id: '525', name: 'Heidelberg', address: 'Eppelheimer Str. 20', postal: '69115', city: 'Heidelberg', lat: 49.4042, lng: 8.6641 },
  { id: '526', name: 'Pforzheim', address: 'Karlsruher Str. 80', postal: '75179', city: 'Pforzheim', lat: 48.8985, lng: 8.6841 },

  // ── Bayern ────────────────────────────────────────────────────────────
  { id: '710', name: 'München-Fröttmaning', address: 'Maria-Goeppert-Mayer-Str. 1', postal: '80939', city: 'München', lat: 48.2045, lng: 11.6212 },
  { id: '711', name: 'München-Freiham', address: 'Hans-Steinkohl-Straße 1', postal: '81249', city: 'München', lat: 48.1382, lng: 11.4112 },
  { id: '712', name: 'Nürnberg', address: 'Trierer Str. 180', postal: '90469', city: 'Nürnberg', lat: 49.4182, lng: 11.0841 },
  { id: '713', name: 'Augsburg', address: 'Bürgermeister-Wegele-Str. 10', postal: '86167', city: 'Augsburg', lat: 48.4012, lng: 10.9241 },
  { id: '714', name: 'Regensburg', address: 'Sulzfeldstraße 1', postal: '93055', city: 'Regensburg', lat: 49.0212, lng: 12.1412 },
  { id: '715', name: 'Würzburg', address: 'Nürnberger Str. 100', postal: '97076', city: 'Würzburg', lat: 49.7942, lng: 9.9641 },
  { id: '716', name: 'Ingolstadt', address: 'Manchinger Str. 110', postal: '85053', city: 'Ingolstadt', lat: 48.7451, lng: 11.4541 },
  { id: '717', name: 'Fürth', address: 'Flößaustraße 100', postal: '90763', city: 'Fürth', lat: 49.4612, lng: 10.9841 },

  // ── Sachsen, Thüringen & Sachsen-Anhalt ────────────────────────────────
  { id: '810', name: 'Dresden-Kaditz', address: 'Peschelstraße 39', postal: '01139', city: 'Dresden', lat: 51.0882, lng: 13.6941 },
  { id: '811', name: 'Leipzig', address: 'Dübener Landstraße 100', postal: '04129', city: 'Leipzig', lat: 51.3782, lng: 12.3841 },
  { id: '812', name: 'Chemnitz', address: 'Neefestraße 150', postal: '09116', city: 'Chemnitz', lat: 50.8142, lng: 12.8741 },
  { id: '813', name: 'Erfurt', address: 'Kühnhäuser Str. 1', postal: '99095', city: 'Erfurt', lat: 51.0212, lng: 10.9841 },
  { id: '814', name: 'Magdeburg', address: 'Salbker Chaussee 65', postal: '39118', city: 'Magdeburg', lat: 52.0841, lng: 11.6142 },
  { id: '815', name: 'Halle (Saale)', address: 'Delitzscher Str. 50', postal: '06112', city: 'Halle', lat: 51.4882, lng: 12.0142 },

  // ── Rheinland-Pfalz & Saarland ─────────────────────────────────────────
  { id: '530', name: 'Mainz-Kastel', address: 'Boelckestraße 50', postal: '55252', city: 'Mainz-Kastel', lat: 50.0142, lng: 8.2841 },
  { id: '531', name: 'Ludwigshafen', address: 'Oderstraße 1', postal: '67071', city: 'Ludwigshafen', lat: 49.4982, lng: 8.3841 },
  { id: '532', name: 'Kaiserslautern', address: 'Merkurstraße 20', postal: '67663', city: 'Kaiserslautern', lat: 49.4412, lng: 7.7241 },
  { id: '533', name: 'Trier', address: 'Zur Maiwiese 1', postal: '54292', city: 'Trier', lat: 49.7782, lng: 6.6741 },
  { id: '534', name: 'Koblenz', address: 'Andernacher Str. 200', postal: '56070', city: 'Koblenz', lat: 50.3782, lng: 7.5841 },
  { id: '535', name: 'Saarbrücken', address: 'Breslauer Str. 1', postal: '66121', city: 'Saarbrücken', lat: 49.2212, lng: 7.0241 },
];

/**
 * Berechnet die Luftlinien-Entfernung in Kilometern nach der Haversine-Formel.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Entfernung in km (auf 1 Nachkommastelle gerundet)
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Erdradius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Ermittelt anhand gegebener Koordinaten (z. B. Smartphone-GPS) die nächstgelegenen HORNBACH-Märkte.
 *
 * @param {number} lat - Breitengrad des Geräts
 * @param {number} lng - Längengrad des Geräts
 * @param {number} [limit=5] - Maximale Anzahl zurückgegebener Filialen
 * @returns {Array<typeof HORNBACH_STORES[0] & { distanceKm: number }>}
 */
export function findNearestStores(lat, lng, limit = 5) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('Gültige Breiten- und Längengrade erforderlich');
  }

  const withDistances = HORNBACH_STORES.map((store) => {
    const distanceKm = calculateDistanceKm(lat, lng, store.lat, store.lng);
    return {
      ...store,
      distanceKm,
    };
  });

  // Sortiere nach geringster Entfernung
  withDistances.sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistances.slice(0, limit);
}
