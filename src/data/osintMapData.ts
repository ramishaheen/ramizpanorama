export interface OSINTLink {
  category: string;
  label: string;
  url: string;
}

export interface OSINTCountry {
  country: string;
  lat: number;
  lng: number;
  links: OSINTLink[];
}

export const OSINT_CATEGORIES = [
  "cadastral", "business_registry", "court_records", "yellow_pages",
  "transport", "vehicle_info", "passenger_lists", "other"
] as const;

export type OSINTCategory = typeof OSINT_CATEGORIES[number];

export const CATEGORY_LABELS: Record<OSINTCategory, string> = {
  cadastral: "Cadastral Maps",
  business_registry: "Business Registry",
  court_records: "Court Records",
  yellow_pages: "Yellow/White Pages",
  transport: "Transport Maps",
  vehicle_info: "Vehicle Info",
  passenger_lists: "Passenger Lists",
  other: "Other Resources",
};

export const CATEGORY_ICONS: Record<OSINTCategory, string> = {
  cadastral: "🗺",
  business_registry: "🏢",
  court_records: "⚖️",
  yellow_pages: "📒",
  transport: "🚌",
  vehicle_info: "🚗",
  passenger_lists: "🛳",
  other: "🔍",
};

export const osintMapData: OSINTCountry[] = [
  { country: "Afghanistan", lat: 33.93, lng: 67.71, links: [
    { category: "business_registry", label: "Central Business Registry", url: "http://203.215.33.115/CompanyVerification/Pages/BuReVerification.aspx" },
  ]},
  { country: "Albania", lat: 41.15, lng: 20.17, links: [
    { category: "cadastral", label: "Geoportal Albania", url: "https://geoportal.asig.gov.al/map/?fc_name=alb_p_asig&auto=true" },
    { category: "court_records", label: "Supreme Court (Civil)", url: "http://www.gjykata.gov.al/gjykata-e-lart%C3%AB/gjykata-e-lart%C3%AB/c%C3%ABshtjet-gjyq%C3%ABsore/c%C3%ABshtjet-civile/" },
    { category: "court_records", label: "Supreme Court (Criminal)", url: "http://www.gjykata.gov.al/gjykata-e-lart%C3%AB/gjykata-e-lart%C3%AB/c%C3%ABshtjet-gjyq%C3%ABsore/c%C3%ABshtjet-penale/" },
    { category: "yellow_pages", label: "Albania Yellow Pages", url: "http://albanianyellowpages.com/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://albaniayp.com/" },
  ]},
  { country: "Algeria", lat: 28.03, lng: 1.66, links: [
    { category: "business_registry", label: "Sidjilcom Business Registry", url: "https://sidjilcom.cnrc.dz/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://algeriayp.com/" },
  ]},
  { country: "Argentina", lat: -38.42, lng: -63.62, links: [
    { category: "business_registry", label: "Argentina Gov Data", url: "https://www.argentina.gob.ar/aaip/datospersonales/reclama" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://amarillas.emol.com/home" },
    { category: "court_records", label: "Court Search", url: "https://www.cij.gov.ar/buscador-de-fallos.html" },
    { category: "other", label: "Business Search", url: "https://www.arempresas.com/" },
  ]},
  { country: "Armenia", lat: 40.07, lng: 45.04, links: [
    { category: "cadastral", label: "e-Cadastre Armenia", url: "https://www.e-cadastre.am/customer/login/map/1" },
    { category: "business_registry", label: "Tax Registry", url: "http://www.petekamutner.am/tsOS_Taxpayers.aspx" },
    { category: "court_records", label: "Legal Information System", url: "https://www.arlis.am/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://armeniayp.com/" },
  ]},
  { country: "Australia", lat: -25.27, lng: 133.78, links: [
    { category: "other", label: "Australian OSINT Tools", url: "https://start.me/p/L10kJ6/australian-osint" },
    { category: "cadastral", label: "NSW Planning Portal", url: "https://www.planningportal.nsw.gov.au/spatialviewer/#/find-a-property/address" },
    { category: "business_registry", label: "ABN Lookup", url: "https://abr.business.gov.au/Search/" },
    { category: "transport", label: "AnyTrip", url: "https://anytrip.com.au/" },
    { category: "passenger_lists", label: "NAA Record Search", url: "https://recordsearch.naa.gov.au/" },
    { category: "yellow_pages", label: "White Pages", url: "http://www.whitepages.com.au/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://www.yellowpages.com.au/" },
    { category: "other", label: "Planning Alerts", url: "https://www.planningalerts.org.au/" },
    { category: "other", label: "Person Lookup", url: "https://personlookup.com.au/" },
    { category: "other", label: "Public Toilets Map", url: "https://toiletmap.gov.au/" },
  ]},
  { country: "Austria", lat: 47.52, lng: 14.55, links: [
    { category: "business_registry", label: "FirmenABC", url: "https://www.firmenabc.at/" },
    { category: "yellow_pages", label: "Herold Yellow Pages", url: "http://www.herold.at/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://austriayp.com/" },
  ]},
  { country: "Azerbaijan", lat: 40.14, lng: 47.58, links: [
    { category: "business_registry", label: "e-Taxes Registry", url: "https://www.e-taxes.gov.az/ebyn/commersialChecker.jsp" },
    { category: "court_records", label: "Electronic Courts", url: "https://e-mehkeme.gov.az/Public/Cases?courtid=" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://azerbaijanyp.com/" },
  ]},
  { country: "Bahrain", lat: 26.07, lng: 50.55, links: [
    { category: "yellow_pages", label: "Bahrain Yellow Pages", url: "http://www.bahrainyellowpages.com.bh/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.bahrainyellow.com/" },
  ]},
  { country: "Bangladesh", lat: 23.68, lng: 90.36, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.bangladeshyp.com/" },
  ]},
  { country: "Belarus", lat: 53.71, lng: 27.95, links: [
    { category: "cadastral", label: "NCA Cadastral Map", url: "https://map.nca.by/" },
    { category: "business_registry", label: "Belgiss Registry", url: "https://tsouz.belgiss.by/#!/tsouz/certifs" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.yelo.by/" },
  ]},
  { country: "Belgium", lat: 50.50, lng: 4.47, links: [
    { category: "business_registry", label: "KBO Business Registry", url: "https://kbopub.economie.fgov.be/kbopub/zoeknaamfonetischform.html" },
    { category: "yellow_pages", label: "White Pages", url: "http://www.1207.be/" },
    { category: "yellow_pages", label: "Golden Pages", url: "http://www.pagesdor.be/" },
    { category: "other", label: "OpenTheBox Company Connections", url: "https://openthebox.be/search" },
    { category: "other", label: "Central Balance Sheet Office", url: "https://www.nbb.be/en/central-balance-sheet-office" },
  ]},
  { country: "Bolivia", lat: -16.29, lng: -63.59, links: [
    { category: "yellow_pages", label: "Bolivia Yellow Pages", url: "http://bolivia.paginasamarillas.com/" },
  ]},
  { country: "Bosnia and Herzegovina", lat: 43.92, lng: 17.68, links: [
    { category: "business_registry", label: "Bisnode Registry", url: "https://search.bisnode.rs/search/?c=ba&q=" },
  ]},
  { country: "Brazil", lat: -14.24, lng: -51.93, links: [
    { category: "court_records", label: "National Arrest Warrants", url: "https://portalbnmp.cnj.jus.br/#/pesquisa-peca#" },
    { category: "court_records", label: "JusBrasil Court Search", url: "https://www.jusbrasil.com.br/" },
    { category: "other", label: "People & Business Search", url: "https://www.escavador.com/" },
    { category: "other", label: "CPF/CNPJ Search", url: "https://www.situacao-cadastral.com/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://brazilyello.com/" },
  ]},
  { country: "Bulgaria", lat: 42.73, lng: 25.49, links: [
    { category: "yellow_pages", label: "Phone Search", url: "https://www.vivacom.bg/bg/residential/polezni-syveti/ukazatel/telefonni-nomera" },
    { category: "other", label: "eGov Open Portal", url: "https://data.egov.bg/" },
    { category: "business_registry", label: "Commercial Register", url: "https://portal.registryagency.bg/en/commercial-register" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://yellowpages.bg/bg/" },
  ]},
  { country: "Cambodia", lat: 12.57, lng: 104.99, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "http://cambodiayp.com/" },
  ]},
  { country: "Canada", lat: 56.13, lng: -106.35, links: [
    { category: "other", label: "Canadian OSINT Tools", url: "https://start.me/p/aLe0vp/osint-resources-in-canada" },
    { category: "yellow_pages", label: "411 White Pages", url: "https://411numbers-canada.com/" },
    { category: "yellow_pages", label: "Canada 411", url: "http://mobile.canada411.ca/" },
    { category: "other", label: "Trademarks Database", url: "https://www.ic.gc.ca/app/opic-cipo/trdmrks/srch/home?lang=eng" },
    { category: "business_registry", label: "Business Registry", url: "https://beta.canadasbusinessregistries.ca/search" },
    { category: "other", label: "RCMP Firearms Reference", url: "https://www.armalytics.ca/" },
    { category: "other", label: "Cell Tower Sites", url: "https://www.ertyu.org/steven_nikkel/cancellsites.html" },
  ]},
  { country: "Chile", lat: -35.68, lng: -71.54, links: [
    { category: "yellow_pages", label: "Chile Yellow Pages", url: "http://www.galaxy.com/rvw18197-841205/Chile-Electronic-Yellow-Pages.htm" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.yelu.cl/" },
  ]},
  { country: "China", lat: 35.86, lng: 104.20, links: [
    { category: "other", label: "China OSINT Tools", url: "https://start.me/p/7kLY9R/osint-chine" },
    { category: "business_registry", label: "1688 Business Check", url: "https://xinyong.1688.com/" },
    { category: "court_records", label: "Judicial Process Info", url: "https://splcgk.court.gov.cn/lcgkw/user#" },
    { category: "court_records", label: "Judgments Online", url: "https://wenshu.court.gov.cn/" },
    { category: "yellow_pages", label: "China Yellow Pages", url: "http://www.yellowpages-china.com/" },
    { category: "other", label: "Xinjiang Victims Database", url: "https://shahit.biz/eng/" },
  ]},
  { country: "Colombia", lat: 4.57, lng: -74.30, links: [
    { category: "yellow_pages", label: "Colombian Yellow Pages", url: "http://www.paginasamarillas.com.co/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.yelu.com.co/" },
  ]},
  { country: "Costa Rica", lat: 9.75, lng: -83.75, links: [
    { category: "yellow_pages", label: "Costa Rica Yellow Pages", url: "http://costa-rica.paginasamarillas.com/" },
  ]},
  { country: "Croatia", lat: 45.10, lng: 15.20, links: [
    { category: "business_registry", label: "CompanyWall", url: "https://www.companywall.hr/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://croatiayp.com/" },
  ]},
  { country: "Cuba", lat: 21.52, lng: -77.78, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.yellocu.com/" },
    { category: "other", label: "People Search (Telegram)", url: "https://t.me/ETECSABD_bot" },
  ]},
  { country: "Cyprus", lat: 35.13, lng: 33.43, links: [
    { category: "cadastral", label: "Geoportal Cyprus", url: "http://eservices.dls.moi.gov.cy/#/national/geoportalmapviewer" },
    { category: "business_registry", label: "Company Registry", url: "https://efiling.drcor.mcit.gov.cy/DrcorPublic/SearchForm.aspx" },
    { category: "court_records", label: "CyLaw Legal Documents", url: "https://cylaw.org/" },
  ]},
  { country: "Czech Republic", lat: 49.82, lng: 15.47, links: [
    { category: "business_registry", label: "Justice.cz Registry", url: "https://or.justice.cz/ias/ui/rejstrik-$firma?" },
    { category: "vehicle_info", label: "SPZ Vehicle Check", url: "https://spz.penize.cz/" },
    { category: "yellow_pages", label: "Golden Pages", url: "http://www.zlatestranky.cz/" },
  ]},
  { country: "Denmark", lat: 56.26, lng: 9.50, links: [
    { category: "cadastral", label: "Matrikel Cadastral Map", url: "https://kort.matrikel.dk/spatialmap" },
    { category: "business_registry", label: "DataCVR Registry", url: "https://datacvr.virk.dk/data/" },
    { category: "vehicle_info", label: "License Plate Check", url: "https://www.nummerplade.net/nummerplade/" },
    { category: "court_records", label: "Civil Records", url: "https://statstidende.dk/messages" },
    { category: "yellow_pages", label: "Danish Yellow Pages", url: "http://www.yellowpages.dk/" },
  ]},
  { country: "Dominican Republic", lat: 18.74, lng: -70.16, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.yelu.do/" },
  ]},
  { country: "Ecuador", lat: -1.83, lng: -78.18, links: [
    { category: "yellow_pages", label: "Ecuador Yellow Pages", url: "http://www.paginasamarillas.info.ec/" },
  ]},
  { country: "Egypt", lat: 26.82, lng: 30.80, links: [
    { category: "yellow_pages", label: "Egypt Yellow Pages", url: "http://www.yellowpages.com.eg/en" },
  ]},
  { country: "Estonia", lat: 58.60, lng: 25.01, links: [
    { category: "cadastral", label: "Maa-amet GIS", url: "https://xgis.maaamet.ee/xgis2/page/app/maainfo" },
    { category: "vehicle_info", label: "MNT Vehicle Check", url: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf" },
    { category: "court_records", label: "Estonian Courts", url: "https://www.riigiteataja.ee/kohtulahendid/koik_menetlused.html" },
    { category: "business_registry", label: "Äriregister", url: "https://ariregister.rik.ee/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://www.yellowpages.ee/en/" },
  ]},
  { country: "European Union", lat: 50.85, lng: 4.35, links: [
    { category: "other", label: "OpenTender EU", url: "https://opentender.eu/start" },
    { category: "court_records", label: "EUR-Lex Case Law", url: "https://eur-lex.europa.eu/collection/eu-law/eu-case-law.html" },
    { category: "court_records", label: "CURIA Case Law", url: "https://curia.europa.eu/juris/recherche.jsf?language=en" },
    { category: "business_registry", label: "EU Business Registers", url: "https://e-justice.europa.eu/content_find_a_company-489-en.do" },
    { category: "other", label: "Eurostat Database", url: "https://ec.europa.eu/eurostat/data/database" },
  ]},
  { country: "Finland", lat: 61.92, lng: 25.75, links: [
    { category: "cadastral", label: "Maanmittauslaitos", url: "https://asiointi.maanmittauslaitos.fi/karttapaikka/" },
    { category: "business_registry", label: "Asiakastieto", url: "https://www.asiakastieto.fi/yritykset/" },
    { category: "vehicle_info", label: "Biltema Vehicle Parts", url: "https://www.biltema.fi/auton-varaosahaku/" },
    { category: "court_records", label: "Finlex", url: "https://www.finlex.fi/fi/oikeus/" },
    { category: "yellow_pages", label: "Finland Yellow Pages", url: "http://www.fonecta.fi/" },
  ]},
  { country: "France", lat: 46.23, lng: 2.21, links: [
    { category: "cadastral", label: "Cadastre.gouv.fr", url: "https://www.cadastre.gouv.fr/scpc/accueil.do" },
    { category: "business_registry", label: "Verif.com", url: "https://www.verif.com/" },
    { category: "vehicle_info", label: "SIV Auto", url: "https://siv-auto.fr/" },
    { category: "yellow_pages", label: "Pages Jaunes", url: "http://www.pagesjaunes.fr/?lang=en" },
    { category: "transport", label: "SNCF Live", url: "https://www.sncf.com/fr/itineraire-reservation/geolocalisation" },
    { category: "other", label: "Death Records (25M+)", url: "https://deces.matchid.io/search" },
    { category: "other", label: "Pappers Companies", url: "https://www.pappers.fr/" },
  ]},
  { country: "Georgia", lat: 42.32, lng: 43.36, links: [
    { category: "business_registry", label: "Business Registry", url: "https://enreg.reestri.gov.ge/main.php?m=new_index" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://georgiayp.com/" },
  ]},
  { country: "Germany", lat: 51.17, lng: 10.45, links: [
    { category: "business_registry", label: "Unternehmensregister", url: "https://www.unternehmensregister.de/ureg/" },
    { category: "yellow_pages", label: "Klicktel Business Dir", url: "http://www.klicktel.de/branchenbuch" },
    { category: "yellow_pages", label: "Gelbe Seiten", url: "http://www.gelbeseiten.de/" },
    { category: "business_registry", label: "Implisense", url: "https://implisense.com/" },
    { category: "other", label: "Airfields Database", url: "https://ulforum.de/flugplatzliste" },
    { category: "other", label: "FragDenStaat", url: "https://fragdenstaat.de/" },
  ]},
  { country: "Ghana", lat: 7.95, lng: -1.02, links: [
    { category: "yellow_pages", label: "Yellow Pages Ghana", url: "http://yellowpages.com.gh/Home.aspx" },
    { category: "other", label: "TIN Verify", url: "https://gra.gov.gh/online-tools/verify-tin/" },
    { category: "other", label: "Private Security Orgs", url: "https://www.mint.gov.gh/private-security-organisations-in-good-standing/" },
  ]},
  { country: "Greece", lat: 39.07, lng: 21.82, links: [
    { category: "yellow_pages", label: "Greece Yellow Pages", url: "http://www.xo.gr/" },
  ]},
  { country: "Guatemala", lat: 15.78, lng: -90.23, links: [
    { category: "business_registry", label: "Registro Mercantil", url: "http://econsultas.registromercantil.gob.gt/" },
    { category: "yellow_pages", label: "Guatemala Yellow Pages", url: "http://www.paginasamarillas.com.gt/" },
  ]},
  { country: "Hungary", lat: 47.16, lng: 19.50, links: [
    { category: "other", label: "Hungary OSINT Tools", url: "https://start.me/p/kxGLzd/hun-osint" },
    { category: "business_registry", label: "Adoszam Registry", url: "https://www.adoszam.hu/" },
    { category: "court_records", label: "National Court Office", url: "https://eakta.birosag.hu/anonimizalt-hatarozatok" },
    { category: "yellow_pages", label: "White Pages Telekom", url: "https://www.telekom.hu/lakossagi/tudakozo" },
  ]},
  { country: "India", lat: 20.59, lng: 78.96, links: [
    { category: "business_registry", label: "MCA Company Search", url: "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do" },
    { category: "other", label: "GSTIN Tax Search", url: "https://www.thetaxladder.com/search-gstin/" },
    { category: "yellow_pages", label: "Indian Finders", url: "https://www.indianfinders.com/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://yelu.in/" },
  ]},
  { country: "Indonesia", lat: -0.79, lng: 113.92, links: [
    { category: "business_registry", label: "AHU Company Search", url: "https://ahu.go.id/pencarian/profil-pt" },
    { category: "court_records", label: "Supreme Court Registry", url: "https://kepaniteraan.mahkamahagung.go.id/perkara/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://www.yellowpages.co.id/" },
  ]},
  { country: "Iran", lat: 32.43, lng: 53.69, links: [
    { category: "yellow_pages", label: "Iran Yellow Pages", url: "http://www.iranyellowpages.net/en/" },
  ]},
  { country: "Ireland", lat: 53.14, lng: -7.69, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.irelandyp.com/" },
  ]},
  { country: "Israel", lat: 31.05, lng: 34.85, links: [
    { category: "business_registry", label: "ICA Business Search", url: "https://ica.justice.gov.il/AnonymousRequest/Search" },
    { category: "court_records", label: "Supreme Court", url: "https://supreme.court.gov.il/Pages/fullsearch.aspx" },
    { category: "yellow_pages", label: "Israel Yellow Pages", url: "http://www.yellow.com/376.html" },
    { category: "other", label: "Sanctions Lists", url: "https://nbctf.mod.gov.il/en/designations/Pages/downloads.aspx" },
    { category: "other", label: "CT Seizures", url: "https://nbctf.mod.gov.il/en/seizures/Pages/seizureOrders.aspx" },
    { category: "other", label: "Crypto Seizures", url: "https://nbctf.mod.gov.il/en/seizures/Pages/Blockchain1.aspx" },
    { category: "other", label: "Nonprofits Database", url: "https://www.guidestar.org.il/home" },
  ]},
  { country: "Italy", lat: 41.87, lng: 12.57, links: [
    { category: "business_registry", label: "Empresite", url: "https://www.empresite.it/" },
    { category: "vehicle_info", label: "SEVIM Targa Check", url: "https://www.sevim.it/gratis/targa.asp" },
    { category: "yellow_pages", label: "Pronto Yellow Pages", url: "http://www.pronto.it/" },
    { category: "yellow_pages", label: "Pagine Bianche", url: "https://www.paginebianche.it/" },
  ]},
  { country: "Japan", lat: 36.20, lng: 138.25, links: [
    { category: "business_registry", label: "Touki Registry", url: "https://www1.touki.or.jp/gateway.html" },
    { category: "court_records", label: "Japanese Courts", url: "https://www.courts.go.jp/app/hanrei_jp/search1" },
    { category: "yellow_pages", label: "ITP Yellow Pages", url: "http://itp.ne.jp/" },
  ]},
  { country: "Jordan", lat: 30.59, lng: 36.24, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.jordanyp.com/" },
  ]},
  { country: "Kazakhstan", lat: 48.02, lng: 66.92, links: [
    { category: "cadastral", label: "AISGZK Cadastral", url: "http://www.aisgzk.kz/aisgzk/ru/content/maps/" },
    { category: "business_registry", label: "PK Uchet", url: "https://pk.uchet.kz/" },
    { category: "court_records", label: "Supreme Court", url: "https://office.sud.kz/lawsuit/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://kazakhstanyp.com/" },
  ]},
  { country: "Kenya", lat: -0.02, lng: 37.91, links: [
    { category: "cadastral", label: "Mining Cadastre Portal", url: "https://portal.miningcadastre.go.ke/Site/EmbeddedMapPortal.aspx" },
    { category: "yellow_pages", label: "Kenya Yellow Pages", url: "http://www.yellowpageskenya.com/" },
    { category: "court_records", label: "Kenya Law", url: "http://kenyalaw.org/" },
  ]},
  { country: "Kosovo", lat: 42.60, lng: 20.90, links: [
    { category: "cadastral", label: "Geoportal Kosovo", url: "http://geoportal.rks-gov.net/" },
  ]},
  { country: "Kuwait", lat: 29.31, lng: 47.48, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.kuwaityello.com/" },
  ]},
  { country: "Latvia", lat: 56.88, lng: 24.60, links: [
    { category: "cadastral", label: "Kadastrs Latvia", url: "https://www.kadastrs.lv/graphical_data/show" },
    { category: "business_registry", label: "Firmas.lv", url: "http://www.firmas.lv/" },
    { category: "court_records", label: "Court Administration", url: "https://tiesas.lv/e-pakalpojumi/tiesvedibas-gaita" },
  ]},
  { country: "Lebanon", lat: 33.85, lng: 35.86, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.yelleb.com/" },
  ]},
  { country: "Lithuania", lat: 55.17, lng: 23.88, links: [
    { category: "yellow_pages", label: "Visa Lietuva", url: "http://www.visalietuva.lt/" },
    { category: "business_registry", label: "Registru Centras", url: "https://www.registrucentras.lt/jar/p/index.php" },
    { category: "cadastral", label: "Geoportal Lithuania", url: "https://www.geoportal.lt/map/index.jsp?lang=en" },
  ]},
  { country: "Malaysia", lat: 4.21, lng: 101.98, links: [
    { category: "yellow_pages", label: "Malaysia Yellow Pages", url: "http://www.yellowpages.my/" },
    { category: "other", label: "OSINT in Malaysia", url: "https://start.me/p/KMqwBB/osint-in-malaysia-resources" },
  ]},
  { country: "Mexico", lat: 23.63, lng: -102.55, links: [
    { category: "yellow_pages", label: "Mexico Yellow Pages", url: "http://www.seccionamarilla.com.mx/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://yelo.com.mx/" },
  ]},
  { country: "Morocco", lat: 31.79, lng: -7.09, links: [
    { category: "business_registry", label: "DirectInfo", url: "https://www.directinfo.ma/" },
    { category: "court_records", label: "Ministry of Justice", url: "https://www.mahakim.ma/Ar/Services/SuiviAffaires_new/TPI/?Page=ServicesElectronique&TypJur=TPI" },
    { category: "yellow_pages", label: "TeleContact White Pages", url: "http://www.telecontact.ma/" },
  ]},
  { country: "Netherlands", lat: 52.13, lng: 5.29, links: [
    { category: "cadastral", label: "Kadastrale Kaart", url: "https://kadastralekaart.com/kaart" },
    { category: "court_records", label: "Rechtspraak", url: "https://uitspraken.rechtspraak.nl/" },
    { category: "yellow_pages", label: "Telefoon Gids", url: "http://www.detelefoongids.nl/" },
    { category: "transport", label: "OV Zoeker", url: "https://ovzoeker.nl/" },
    { category: "vehicle_info", label: "Kenteken Check", url: "https://www.kentekencheck.nl/kenteken" },
    { category: "business_registry", label: "KVK Registry", url: "https://www.kvk.nl/" },
  ]},
  { country: "New Zealand", lat: -40.90, lng: 174.89, links: [
    { category: "business_registry", label: "Companies Office", url: "https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search" },
    { category: "transport", label: "AnyTrip NZ", url: "https://anytrip.com.au/" },
    { category: "yellow_pages", label: "NZ Yellow Pages", url: "http://yellow.co.nz/" },
    { category: "court_records", label: "Court Records", url: "https://www.courtsofnz.govt.nz/judgments/" },
  ]},
  { country: "Nigeria", lat: 9.08, lng: 8.68, links: [
    { category: "other", label: "Nigeria Business Search", url: "https://nigeria24.me/" },
    { category: "other", label: "Nigeria Business List", url: "https://businesslist.com.ng/" },
    { category: "other", label: "Sex Offenders Database", url: "https://nsod.naptip.gov.ng/view_cases.php" },
  ]},
  { country: "North Korea", lat: 40.34, lng: 127.51, links: [
    { category: "other", label: "AccessDPRK Map 2021", url: "https://mynorthkorea.blogspot.com/2021/01/accessdprk-2021-map-free-version.html" },
  ]},
  { country: "Norway", lat: 60.47, lng: 8.47, links: [
    { category: "cadastral", label: "Geodata Cadastral", url: "https://geodataonline.maps.arcgis.com/apps/Embed/index.html?webmap=384b4cac7e4b4c41980f90dc0f30fb12" },
    { category: "vehicle_info", label: "Vegvesen Vehicle Check", url: "https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/sjekk-kjoretoyopplysninger/" },
    { category: "court_records", label: "Domstol.no", url: "https://www.domstol.no/nar-gar-rettssaken/" },
    { category: "business_registry", label: "Proff.no", url: "https://www.proff.no/" },
    { category: "business_registry", label: "Brønnøysund Register", url: "https://www.brreg.no/" },
    { category: "yellow_pages", label: "Gule Sider", url: "https://www.gulesider.no/" },
  ]},
  { country: "Oman", lat: 21.47, lng: 55.98, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.omanyp.com/" },
  ]},
  { country: "Pakistan", lat: 30.38, lng: 69.35, links: [
    { category: "other", label: "Pakistan Business List", url: "https://businesslist.pk/" },
  ]},
  { country: "Peru", lat: -9.19, lng: -75.02, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.peruyello.com/" },
  ]},
  { country: "Philippines", lat: 12.88, lng: 121.77, links: [
    { category: "other", label: "Philippines Business List", url: "https://businesslist.ph/" },
  ]},
  { country: "Poland", lat: 51.92, lng: 19.15, links: [
    { category: "cadastral", label: "Geoportal Poland", url: "https://mapy.geoportal.gov.pl/imap/Imgp_2.html?gpmap=gp0" },
    { category: "business_registry", label: "Podatki Registry", url: "https://www.podatki.gov.pl/wykaz-podatnikow-vat-wyszukiwarka/" },
    { category: "court_records", label: "SAOS Court Decisions", url: "https://www.saos.org.pl/search" },
    { category: "other", label: "Debt Search", url: "https://dlugi.info/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.polandyp.com/" },
    { category: "other", label: "Poland OSINT Framework", url: "https://otwartezrodla.pl/" },
  ]},
  { country: "Portugal", lat: 39.40, lng: -8.22, links: [
    { category: "business_registry", label: "MJ Publications", url: "http://publicacoes.mj.pt/Pesquisa.aspx" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.portugalyp.com/" },
  ]},
  { country: "Qatar", lat: 25.35, lng: 51.18, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.qataryello.com/" },
  ]},
  { country: "Romania", lat: 45.94, lng: 24.97, links: [
    { category: "yellow_pages", label: "Romania Yellow Pages", url: "http://yellowpages.com.ro/" },
    { category: "court_records", label: "Just.ro Legal Documents", url: "http://portal.just.ro/SitePages/acasa.aspx" },
    { category: "business_registry", label: "Pagini Aurii Companies", url: "https://www.paginiaurii.ro/" },
  ]},
  { country: "Russia", lat: 61.52, lng: 105.32, links: [
    { category: "cadastral", label: "Rosreestr Cadastral", url: "https://pkk.rosreestr.ru/#/search" },
    { category: "business_registry", label: "RMSP Tax Registry", url: "https://rmsp.nalog.ru/" },
    { category: "vehicle_info", label: "Nomerogram", url: "https://www.nomerogram.ru/" },
    { category: "court_records", label: "SUDRF Justice System", url: "https://sudrf.ru/index.php?id=300&searchtype=sp" },
    { category: "court_records", label: "SudAct Judicial Acts", url: "https://sudact.ru/" },
    { category: "yellow_pages", label: "Russian Yellow Pages", url: "http://www.yp.ru/yellow.html/english/?n=2" },
    { category: "other", label: "SaveRuData Leaks Search", url: "https://data.intelx.io/saverudata/" },
    { category: "other", label: "RUPEP PEP Database", url: "https://rupep.org/en/" },
  ]},
  { country: "Saudi Arabia", lat: 23.89, lng: 45.08, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.saudiayp.com/" },
  ]},
  { country: "Serbia", lat: 44.02, lng: 21.01, links: [
    { category: "other", label: "Government Portals", url: "https://www.rsportali.com/" },
    { category: "cadastral", label: "GeoSrbija Cadastral", url: "https://a3.geosrbija.rs/katastar" },
  ]},
  { country: "Singapore", lat: 1.35, lng: 103.82, links: [
    { category: "business_registry", label: "BizFile", url: "https://www.bizfile.gov.sg/" },
    { category: "yellow_pages", label: "Singapore White Pages", url: "http://www.phonebook.com.sg/" },
    { category: "yellow_pages", label: "Singapore Yellow Pages", url: "http://www.yellowpages.com.sg/" },
  ]},
  { country: "Slovakia", lat: 48.67, lng: 19.70, links: [
    { category: "yellow_pages", label: "Zlaté Stránky", url: "http://www.zlatestranky.sk/" },
    { category: "other", label: "Debtor Registry", url: "https://zoznamdlznikov.com/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.slovakiayp.com/" },
  ]},
  { country: "Slovenia", lat: 46.15, lng: 14.99, links: [
    { category: "yellow_pages", label: "Slovenia Yellow Pages", url: "http://yellow3.eunet.si/yellowpage/a/" },
  ]},
  { country: "South Africa", lat: -30.56, lng: 22.94, links: [
    { category: "other", label: "SA OSINT Tools", url: "https://start.me/p/KMAbkB/osint-south-africa" },
    { category: "yellow_pages", label: "SA Yellow Pages", url: "http://www.yellowpages.co.za/" },
    { category: "business_registry", label: "CIPC Search", url: "http://eservices.cipc.co.za/Search.aspx" },
  ]},
  { country: "South Korea", lat: 35.91, lng: 127.77, links: [
    { category: "other", label: "Korean OSINT Tools", url: "https://github.com/SwanLeeSec/rokinttool" },
    { category: "business_registry", label: "FTC Business Registry", url: "https://www.ftc.go.kr/www/bizCommList.do?key=232" },
    { category: "yellow_pages", label: "Korea Yellow Pages", url: "http://www.southkoreapages.com/" },
  ]},
  { country: "Spain", lat: 40.46, lng: -3.75, links: [
    { category: "cadastral", label: "SEC Catastro", url: "https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCBusqueda.aspx" },
    { category: "vehicle_info", label: "Oscaro Spain", url: "https://www.oscaro.es/" },
    { category: "yellow_pages", label: "Páginas Amarillas", url: "http://www.paginasamarillas.es/" },
    { category: "other", label: "InfoCIF Companies", url: "https://www.infocif.es/buscador/#/" },
    { category: "other", label: "Mobile Operator Detect", url: "https://numeracionyoperadores.cnmc.es/portabilidad/movil" },
    { category: "other", label: "Librebor Companies DB", url: "https://librebor.me/en/" },
  ]},
  { country: "Sweden", lat: 60.13, lng: 18.64, links: [
    { category: "yellow_pages", label: "Proff.se Business", url: "http://www.proff.se/" },
    { category: "other", label: "Mobile Operator Lookup", url: "https://nummer.pts.se/NbrSearch" },
    { category: "other", label: "Tax Info Search", url: "https://www.upplysning.se/" },
    { category: "other", label: "Newspaper Archive (1884+)", url: "https://paperarchive-prod.svd.se/" },
    { category: "other", label: "MrKoll People Search", url: "https://mrkoll.se/" },
  ]},
  { country: "Switzerland", lat: 46.82, lng: 8.23, links: [
    { category: "cadastral", label: "Swiss Cadastral Map", url: "https://map.geo.admin.ch/?lang=de&topic=cadastre" },
    { category: "business_registry", label: "Zefix Registry", url: "https://www.zefix.admin.ch/en/search/entity/welcome" },
    { category: "yellow_pages", label: "Branchenbuch", url: "http://www.branchenbuch.ch/" },
  ]},
  { country: "Syria", lat: 34.80, lng: 38.00, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.syriayp.com/" },
  ]},
  { country: "Taiwan", lat: 23.70, lng: 120.96, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "http://taiwanyello.com/" },
    { category: "business_registry", label: "FindBiz", url: "https://findbiz.nat.gov.tw/fts/query/QueryBar/queryInit.do?request_locale=en&fhl=en" },
  ]},
  { country: "Thailand", lat: 15.87, lng: 100.99, links: [
    { category: "cadastral", label: "Land Maps", url: "https://landsmaps.dol.go.th/" },
    { category: "court_records", label: "Court Records", url: "https://decision.coj.go.th/" },
    { category: "business_registry", label: "DBD Datawarehouse", url: "https://datawarehouse.dbd.go.th/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.thaiyello.com/" },
  ]},
  { country: "Turkey", lat: 38.96, lng: 35.24, links: [
    { category: "cadastral", label: "OGM Cadastral", url: "https://cbs.ogm.gov.tr/vatandas/" },
    { category: "court_records", label: "Competition Authority", url: "https://www.rekabet.gov.tr/tr/Davalar" },
    { category: "yellow_pages", label: "TT Rehber White Pages", url: "http://www.ttrehber.turktelekom.com.tr/?type=white" },
    { category: "court_records", label: "UYAP Court Search", url: "http://emsal.uyap.gov.tr/BilgiBankasiIstemciWeb/" },
    { category: "business_registry", label: "Trade Registry", url: "https://www.ticaretsicil.gov.tr/" },
    { category: "other", label: "Association Registry", url: "https://www.turkiye.gov.tr/icisleri-ddb-dernek-sorgulama" },
  ]},
  { country: "Ukraine", lat: 48.38, lng: 31.17, links: [
    { category: "cadastral", label: "Land Cadastral Map", url: "https://map.land.gov.ua/" },
    { category: "transport", label: "eWay Live Transport", url: "https://www.eway.in.ua/en/cities/kyiv/routes" },
    { category: "court_records", label: "Unified Court Decisions", url: "https://reyestr.court.gov.ua/" },
    { category: "yellow_pages", label: "Ukraine Yellow Pages", url: "http://www.ukraine.org/www.ukrainet.lviv.ua/yellow/pages.htm" },
    { category: "other", label: "Myrotvorets Database", url: "https://myrotvorets.center/criminal/" },
    { category: "other", label: "Ukraine 2022 GEOINT", url: "https://github.com/mapconcierge/Ukraine2022data/" },
  ]},
  { country: "United Arab Emirates", lat: 23.42, lng: 53.85, links: [
    { category: "yellow_pages", label: "White Pages", url: "http://www.whitepages.ae/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://yello.ae/" },
  ]},
  { country: "United Kingdom", lat: 55.38, lng: -3.44, links: [
    { category: "business_registry", label: "Companies House", url: "https://beta.companieshouse.gov.uk/search/companies" },
    { category: "transport", label: "Essex Bus Map", url: "http://www.essexbus.info/map.html" },
    { category: "vehicle_info", label: "Car Check UK", url: "https://www.carcheck.co.uk/reg" },
    { category: "yellow_pages", label: "Yell.com", url: "https://www.yell.com/" },
    { category: "yellow_pages", label: "192.com Directory", url: "https://www.192.com/" },
    { category: "court_records", label: "Legislation Search", url: "https://www.legislation.gov.uk/" },
    { category: "other", label: "Census Data Online", url: "https://ukcensusonline.com/search/" },
  ]},
  { country: "United States", lat: 37.09, lng: -95.71, links: [
    { category: "cadastral", label: "QPublic Property Search", url: "https://qpublic.schneidercorp.com/" },
    { category: "vehicle_info", label: "AutoCheck", url: "https://www.autocheck.com/vehiclehistory/autocheck-score" },
    { category: "court_records", label: "JudyRecords (564M Cases)", url: "https://www.judyrecords.com/" },
    { category: "yellow_pages", label: "SuperPages", url: "http://www.superpages.com/" },
    { category: "yellow_pages", label: "Yellow Pages", url: "http://www.yellowpages.com/" },
    { category: "other", label: "Office Floor Plans", url: "https://www.officespace.com/" },
    { category: "other", label: "Critical Energy Map", url: "https://www.bakerinstitute.org/energy-environment-and-policy-in-the-us/" },
    { category: "other", label: "FCC License Search", url: "https://wireless2.fcc.gov/UlsApp/UlsSearch/searchLicense.jsp" },
    { category: "other", label: "National Sex Offenders DB", url: "https://www.nsopw.gov/" },
    { category: "other", label: "US Wind Map", url: "http://hint.fm/wind/" },
    { category: "other", label: "Military Records (Fold3)", url: "https://www.fold3.com/" },
    { category: "other", label: "Historical Aerials", url: "https://historicaerials.com/viewer" },
  ]},
  { country: "Uzbekistan", lat: 41.38, lng: 64.59, links: [
    { category: "business_registry", label: "OrgInfo", url: "https://orginfo.uz/" },
    { category: "court_records", label: "Supreme Court (Criminal)", url: "https://public.sud.uz/#!/sign/criminal" },
    { category: "court_records", label: "Supreme Court (Economic)", url: "https://public.sud.uz/#!/sign/economy" },
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.uzbekistanyp.com/" },
  ]},
  { country: "Venezuela", lat: 6.42, lng: -66.59, links: [
    { category: "yellow_pages", label: "Venezuela Yellow Pages", url: "http://venezuela.paginasamarillas.com/" },
  ]},
  { country: "Vietnam", lat: 14.06, lng: 108.28, links: [
    { category: "business_registry", label: "DKKD Registry", url: "https://dichvuthongtin.dkkd.gov.vn/inf/default.aspx" },
  ]},
  { country: "Yemen", lat: 15.55, lng: 48.52, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "http://yemenyp.com/" },
  ]},
  { country: "Zimbabwe", lat: -19.02, lng: 29.15, links: [
    { category: "yellow_pages", label: "Yellow Pages", url: "https://www.zimbabweyp.com/" },
  ]},
  { country: "Zambia", lat: -13.13, lng: 27.85, links: [
    { category: "cadastral", label: "LandFolio Cadastral", url: "http://portals.landfolio.com/zambia/" },
    { category: "yellow_pages", label: "Zambia Business Directory", url: "https://www.zambiayp.com/" },
  ]},
];
