(function(config) {
    
        var donneesRapport;
        var details;
	var $btnprint = $('#btn-print');
	var $unitsGroup = $('#units-group');
        var $tabhead = $('#tabhead');
        var $tabbody = $('#tabbody');
	var session = null;
        var tabDiesel = [];
        var tabEssence = [];
        var tabGPL = [];
        
        $('#details').hide();
        $('#loader').hide();
        $('#logoHeuresMoteur').hide();
        $('#DfiltreHeures').hide();
        $('#DfiltreNote').hide();
                        
	// Wialon script loading
	var url = getHtmlVar("baseUrl") || getHtmlVar("hostUrl") || "https://hst-api.wialon.com";
	loadScript(url+"/wsdk/script/wialon.js", initSdk);

	// Get language
	var lang = getHtmlVar("lang") || config.lang;
	if (["en", "es", "fr"].indexOf(lang) === -1){
		lang = config.lang;
	}
	
        // Set translation
	$.localise("lang/", {language:lang, complete:ltranslate});
	translate = $.localise.tr;
        
        document.title = translate(config.name);
	$('.top .wrap h1').html(translate(config.name));
                
	// Load datepicker locale
	if (lang !== "en") {
		loadScript("//apps.wialon.com/plugins/wialon/i18n/" + lang + ".js");
	}

	events();

	/** FUNCTION FOR WIALON SCRIPT LOADING */
	function loadScript(src, callback) {
		var script = document.createElement("script");

		script.setAttribute("type", "text/javascript");
		script.setAttribute("charset", "UTF-8");
		script.setAttribute("src", src);

		if (callback && typeof callback === "function") {
			script.onload = callback;
		}

		document.getElementsByTagName("head")[0].appendChild(script);
	}

	/** SDK INITIALIZING */
	function initSdk() {
		var url = getHtmlVar("baseUrl");
		if(!url) {
                    url = getHtmlVar("hostUrl");
		}
                if(!url) {
                    url = 'https://hst-api.wialon.com';
		}

		var params = {
			'authHash' : getHtmlVar("authHash") || getHtmlVar("access_hash"),
			'sid' : getHtmlVar("sid"),
			'token' : getHtmlVar("token") || getHtmlVar("access_token")
		};
                
		// Session initialize
		session = wialon.core.Session.getInstance();
		session.initSession(url);
		session.loadLibrary("unitEvents");

		smartLogin(params);
	}

	/** AUTHORIZATION */
	function smartLogin(params) {
		var user = getHtmlVar("user") || "";

		if(params.authHash) {
			session.loginAuthHash(params.authHash, function(code) {loginCallback(code, params, 'authHash');});
		} else if (params.sid) {
			session.duplicate(params.sid, user, true, function(code) {loginCallback(code, params, 'sid');});
		} else if (params.token) {
			session.loginToken(params.token, function(code) {loginCallback(code, params, 'token');});
		} else {
			redirectToLoginPage();
		}
	}

	/** LOGIN CALLBACK */
	function loginCallback(code, params, param) {
		if (code) {
			delete params[param];

			smartLogin(params);
		} else {
			var user = session.getCurrUser();

			user.getLocale(function(arg, locale) {
				// Check for users who have never changed the parameters of the metric
				var fd = (locale && locale.fd) ? locale.fd : '%Y-%m-%E_%H:%M:%S';

				var initDatepickerOpt = {
					wd_orig: locale.wd,
					fd: fd
				};
                                
                                var regional = $.datepicker.regional[lang];
				if (regional) {
					$.datepicker.setDefaults(regional);

					// Also wialon locale
					wialon.util.DateTime.setLocale(
						regional.dayNames,
						regional.monthNames,
						regional.dayNamesShort,
						regional.monthNamesShort
					);
				}
                                
				initDatepicker(initDatepickerOpt.fd, initDatepickerOpt.wd_orig);
                                init();
                                tableauDiesel();
			});
		}
	}

	/** REDIRECT TO LOGIN PAGE */
	function redirectToLoginPage() {
		var cur = window.location.href;

		// Remove bad parameters from url
		cur = cur.replace(/\&{0,1}(sid|token|authHash|access_hash|access_token)=\w*/g, '');
		cur = cur.replace(/[\?\&]*$/g, '');

		var url = config.homeUrl + '/login.html?client_id=' + config.name + '&lang=' + lang + '&duration=3600&redirect_uri=' + encodeURIComponent(cur);

		window.location.href = url;
	}

	/** DATEPICKER INITIALIZING */
	function initDatepicker(setDateFormat, firstDayOrig) {
		var options = {
			template: '<div class="interval-wialon {className}" id="{id}">' +
							'<div class="iw-select">' +
								'<button data-period="0" type="button" class="iw-period-btn period_0">{yesterday}</button>' +
								'<button data-period="1" type="button" class="iw-period-btn period_1">{today}</button>' +
								'<button data-period="2" type="button" class="iw-period-btn period_2">{week}</button>' +
								'<button data-period="3" type="button" class="iw-period-btn period_3">{month}</button>' +
								'<button data-period="4" type="button" class="iw-period-btn period_4">{custom}</button>' +
							'</div>' +
							'<div class="iw-pickers">' +
								'<input type="text" class="iw-from" id="date-from"/> &ndash; <input type="text" class="iw-to" id="date-to"/>' +
								'<button type="button" class="iw-time-btn">{ok}</button>' +
							'</div>' +
							'<div class="iw-labels">' +
								'<a href="#" class="iw-similar-btn past" id="past" data-similar="past"></a> ' +
								'<span class="iw-label"></span> ' +
								'<a href="#" class="iw-similar-btn future" id="future" data-similar="future"></a>' +
							'</div>' +
						'</div>',
			labels: {
				yesterday: translate('Hier'),
				today: translate("Aujourd'hui"),
				week: translate('Semaine'),
				month: translate('Mois'),
				custom: translate('Personaliser'),
				ok: "OK"
			},
			datepicker: {},
			onInit: function(){
				$("#ranging-time-wrap").intervalWialon('set', 3);
			},
			onChange: function(data){
				currentInterval = $("#ranging-time-wrap").intervalWialon('get');
			},
			onAfterClick: function () {
			},
			tzOffset: wialon.util.DateTime.getTimezoneOffset(),
			now: session.getServerTime()
		};

		options.dateFormat = wialon.util.DateTime.convertFormat(setDateFormat.split('_')[0], true);
		options.firstDay = firstDayOrig;

		// Remember date format
		formatDate = setDateFormat.split('_')[0];

		$("#ranging-time-wrap").intervalWialon(options);
	}

	/** EVENTS */
	function events() {
		var $rtw = $('#ranging-time-wrap');

		// Click on select-box
		$unitsGroup.on('change', function() {                        
			var id = $('option:selected', $unitsGroup).val();

			if(id) {
                                $('#loader').show();
                                $('#details').hide();
                                donneesRapport = [];
                                details = [];
                                executeReport();
			}
		});

		// Click on date interval
		$rtw.on('click', '.iw-period-btn, .iw-time-btn', function() {                        
			if($(this).index() !== 4) {
				var id = $('option:selected', $unitsGroup).val();

				if(id && id!==translate("Choisir la flotte")) {
                                        $('#loader').show();
                                        $('#details').hide();
                                        donneesRapport = [];
                                        details = [];
                                        executeReport();
                                }
			}
		});
                
                $('#litreKm').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();
                    }                  
                });
                
                $('#litreHeure').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();
                    }                  
                });
                
                $('#kilometrage').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();                        
                    }
                    $('#logoHeuresMoteur').hide();
                    $('#logoKilometrage').show();
                    $('#DfiltreHeures').hide();
                    $('#DfiltreKilo').show();
                });
                
                $('#heuresMoteur').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();                       
                    }
                    $('#logoKilometrage').hide();
                    $('#logoHeuresMoteur').show();
                    $('#DfiltreKilo').hide();
                    $('#DfiltreHeures').show();
                });
                
                $('#co2').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();                       
                    }                    
                    $('#DfiltreNote').hide();
                    $('#DfiltreCo2').show();
                });
                
                $('#note').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();                       
                    }
                    $('#DfiltreCo2').hide();
                    $('#DfiltreNote').show();
                });
                
                $('#sonde').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();
                    }                  
                });
                
                $('#can-bus').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();
                    }                  
                });
                
                $('.input-filtre').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();
                    }
                });
                
                $('.input-filtreHeure').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();
                    }
                });
                
                $('.input-filtreMinute').on('change', function() {
                    if (donneesRapport) {
                        afficherDonnees();
                        $('#details').hide();
                    }
                });
                
                $('#voirOuPas').on('click', function() {
                   modifOpt(); 
                });
                
                $('#titreConso').on('click', function() {
                    if ($('#sonde').attr('checked')) {
                        if ($('#litreKm').attr('checked')) {
                            afficheDetailsConsoKmFLS();
                        } else {
                            afficheDetailsConsoHeureFLS();
                        }
                    } else {
                        if ($('#litreKm').attr('checked')) {
                            afficheDetailsConsoKmCAN();
                        } else {
                            afficheDetailsConsoHeureCAN();
                        }
                    }                   
                    $('#details').show();
                });
                
                $('#logoConso').on('click', function() {
                    if ($('#sonde').attr('checked')) {
                        if ($('#litreKm').attr('checked')) {
                            afficheDetailsConsoKmFLS();
                        } else {
                            afficheDetailsConsoHeureFLS();
                        }
                    } else {
                        if ($('#litreKm').attr('checked')) {
                            afficheDetailsConsoKmCAN();
                        } else {
                            afficheDetailsConsoHeureCAN();
                        }
                    }                    
                    $('#details').show();
                });
                
                $('#titreConsoAMT').on('click', function() {
                    afficheDetailsConsoAMT();
                    $('#details').show();
                });
                
                $('#logoConsoAMT').on('click', function() {
                    afficheDetailsConsoAMT();
                    $('#details').show();
                });
                
                $('#titreUtilisation').on('click', function() {
                    if ($('#kilometrage').attr('checked')) {
                        afficheDetailsKilometrage();
                    } else {
                        afficheDetailsHeures();
                    }                    
                    $('#details').show();
                });
                
                $('#logoUtilisation').on('click', function() {
                    if ($('#kilometrage').attr('checked')) {
                        afficheDetailsKilometrage();
                    } else {
                        afficheDetailsHeures();
                    }  
                    $('#details').show();
                });
                
                $('#titrePleins').on('click', function() {
                    afficheDetailsPleins();
                    $('#details').show();
                });
                
                $('#logoPleins').on('click', function() {
                    afficheDetailsPleins();
                    $('#details').show();
                });
                
                $('#titreVols').on('click', function() {
                    afficheDetailsVols();
                    $('#details').show();
                });
                
                $('#logoVols').on('click', function() {
                    afficheDetailsVols();
                    $('#details').show();
                });
                
                $('#titreEco').on('click', function() {
                    if ($('#note').attr('checked')) {
                        afficheDetailsNote();
                    } else {
                        afficheDetailsCo2();
                    }                    
                    $('#details').show();
                });
                
                $('#logoEco').on('click', function() {
                    if ($('#note').attr('checked')) {
                        afficheDetailsNote();
                    } else {
                        afficheDetailsCo2();
                    }                    
                    $('#details').show();
                });
                
                
		// Print click
		$btnprint.on('click', function() {
                    var id = $('option:selected', $unitsGroup).val();
                    if (id) {
                        print();
                    } else {
                        alert(translate("Il n'y a pas de données à imprimer. Veuillez sélectionner une flotte."));
                    }
		});
        }
        
        function print() {
		var resultCode = '';
		var window_;
                
                //construction tableau de bord simplifié                
                var codeTab =   '<div class="breakafter">' +
                                    '<h5>' + translate('Résumé') + ' :</h5>' +
                                    '<table id="scheme-head" style="border: 3px solid #e2e3e5;">' +
                                        '<thead id="tabhead">' +
                                            '<tr><th style="border: 3px solid #e2e3e5; text-align: center;">' + translate('Consommation globale') + '</th><th style="border: 3px solid #e2e3e5; text-align: center;">' + translate('Consommation AMT') + '</th><th style="border: 3px solid #e2e3e5; text-align: center;">' + translate('Utilisation') + '</th></tr>' +
                                        '</thead>' +
                                        '<tbody id="tabbody">' +
                                            '<tr><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#consoMoy').clone().html() + '</td><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#consoAMTTot').clone().html() + '</td><td style="border: 1px solid #e2e3e5; text-align: center;">' + $('#utilisationTot').clone().html() + '</td></tr>' +
                                            '<tr><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#consoMax').clone().html() + '</td><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#consoAMTMax').clone().html() + '</td><td style="border: 1px solid #e2e3e5; text-align: center;">' + $('#utilisationMax').clone().html() + '</td></tr>' +
                                            '<tr><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#consoMin').clone().html() + '</td><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#consoAMTMin').clone().html() + '</td><td style="border: 1px solid #e2e3e5; text-align: center;">' + $('#utilisationMin').clone().html() + '</td></tr>' +
                                        '</tbody>' +
                                        '<thead id="tabhead">' +
                                            '<tr><th style="border: 3px solid #e2e3e5; text-align: center;">' + translate('Pleins') + '</th><th style="border: 3px solid #e2e3e5; text-align: center;">' + translate('Vols carburant') + '</th><th style="border: 3px solid #e2e3e5; text-align: center;">' + translate('Eco-impact') + '</th></tr>' +
                                        '</thead>' +
                                        '<tbody id="tabbody">' +
                                            '<tr><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#pleinTot').clone().html() + '</td><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#volTot').clone().html() + '</td><td style="border: 1px solid #e2e3e5; text-align: center;">' + $('#ecoMoy').clone().html() + '</td></tr>' +
                                            '<tr><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#pleinMax').clone().html() + '</td><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#volMax').clone().html() + '</td><td style="border: 1px solid #e2e3e5; text-align: center;">' + $('#ecoMax').clone().html() + '</td></tr>' +
                                            '<tr><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#pleinMin').clone().html() + '</td><td style="border: 1px solid #e2e3e5; border-right-width: 3px; text-align: center;">' + $('#volMin').clone().html() + '</td><td style="border: 1px solid #e2e3e5; text-align: center;">' + $('#ecoMin').clone().html() + '</td></tr>' +
                                        '</tbody>' +
                                    '</table>'
                                '</div>';                        
                    
                //construction tableau conso globale
                var tableauConso =[];            
                var codeConso;
                var unite;
                for (var i=0; i<donneesRapport.trajets.length; i++) {
                    var conso;
                    if ($('#sonde').attr('checked')) {
                        codeConso = '<div class="breakafter"><h5>' + translate('Détails consommation globale') + ' (FLS) :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="conso">' + translate('Consommation') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                        if ($('#litreKm').attr('checked')) {
                            conso = Number(((donneesRapport.trajets[i].c[2]).split(" "))[0]);
                            unite = " L/100km";
                            if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                                var vehicule = donneesRapport.trajets[i].c[0];
                                var conduc = donneesRapport.trajets[i].c[4];
                                if (conduc === "") {
                                    conduc = translate('conducteur non renseigné');
                                } else if (conduc === "Drivers...") {
                                    conduc = translate('conducteurs multiples');
                                }
                                var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                                tableauConso.push(ligne);
                            }  
                        } else {
                            conso = Number(((donneesRapport.heures[i].c[3]).split(" "))[0]);
                            unite = " L/h";
                            if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                                var vehicule = donneesRapport.heures[i].c[0];
                                var conduc = donneesRapport.heures[i].c[1];
                                if (conduc === "") {
                                    conduc = translate('conducteur non renseigné');
                                } else if (conduc === "Drivers...") {
                                    conduc = translate('conducteurs multiples');
                                }
                                var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                                tableauConso.push(ligne);
                            }  
                        }
                    } else {
                        codeConso = '<div class="breakafter"><h5>' + translate('Détails consommation globale') + ' (CAN bus) :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="conso">' + translate('Consommation') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                        if ($('#litreKm').attr('checked')) {
                            conso = Number(((donneesRapport.trajets[i].c[5]).split(" "))[0]);
                            unite = " L/100km";
                            if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                                var vehicule = donneesRapport.trajets[i].c[0];
                                var conduc = donneesRapport.trajets[i].c[4];
                                if (conduc === "") {
                                    conduc = translate('conducteur non renseigné');
                                } else if (conduc === "Drivers...") {
                                    conduc = translate('conducteurs multiples');
                                }
                                var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                                tableauConso.push(ligne);
                            }  
                        } else {
                            conso = Number(((donneesRapport.heures[i].c[4]).split(" "))[0]);
                            unite = " L/h";
                            if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                                var vehicule = donneesRapport.heures[i].c[0];
                                var conduc = donneesRapport.heures[i].c[1];
                                if (conduc === "") {
                                    conduc = translate('conducteur non renseigné');
                                } else if (conduc === "Drivers...") {
                                    conduc = translate('conducteurs multiples');
                                }
                                var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                                tableauConso.push(ligne);
                            }  
                        }
                    }                                
                }            
                tableauConso.sort(function (b, a) {
                   return a.cons - b.cons; 
                });
                for (var i = 0; i < tableauConso.length; i++) {
                    codeConso += ("<tr><td>" + tableauConso[i].vehi + "</td><td>" + tableauConso[i].cons + unite + "</td><td>" + tableauConso[i].cond + "</td></tr>");
                }
                codeConso += '</tbody></table></div>';
                    
                //construction tableau conso AMT
                var tableauAMT = [];
                var codeAMT = '<div class="breakafter"><h5>' + translate('Détails consommation AMT') + ' :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="consoAMT">' + translate('Consommation AMT') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                for (var i=0; i<donneesRapport.heures.length; i++) {   
                    var consoAMT = Number((donneesRapport.heures[i].c[2]).replace(/ lt/i, ""));
                    if (consoAMT >= $('#filtreConsoAMTMin').val() && consoAMT <= $('#filtreConsoAMTMax').val()) {
                        var vehicule = donneesRapport.heures[i].c[0];
                        var conduc = donneesRapport.heures[i].c[1];
                        if (conduc === "") {
                            conduc = translate('conducteur non renseigné');
                        } else if (conduc === "Drivers...") {
                            conduc = translate('conducteurs multiples');
                        }                
                        var ligne = {vehi: vehicule, cons: consoAMT, cond: conduc};
                        tableauAMT.push(ligne);
                    }                    
                }            
                tableauAMT.sort(function (b, a) {
                   return a.cons - b.cons; 
                });            
                for (var i = 0; i < tableauAMT.length; i++) {
                    codeAMT += ("<tr><td>" + tableauAMT[i].vehi + "</td><td>" + tableauAMT[i].cons + " L</td><td>" + tableauAMT[i].cond + "</td></tr>");
                }
                codeAMT += '</tbody></table></div>';
                
                //construction tableau utilisation
                var tableauUtil = [];
                var codeUtil;
                if ($('#kilometrage').attr('checked')) {
                    codeUtil = '<div class="breakafter"><h5>' + translate('Détails kilométrage') + ' :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="kilometrage">' + translate('Kilométrage') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                    for (var i=0; i<donneesRapport.trajets.length; i++) { 
                        var km = Number((donneesRapport.trajets[i].c[1]).replace(/ km/i, ""));
                        if (km >= $('#filtreKiloMin').val() && km <= $('#filtreKiloMax').val()) {
                            var vehicule = donneesRapport.trajets[i].c[0];                    
                            var conduc = donneesRapport.trajets[i].c[4];
                            if (conduc === "") {
                                conduc = translate('conducteur non renseigné');
                            } else if (conduc === "Drivers...") {
                                conduc = translate('conducteurs multiples');
                            }
                            var ligne = {vehi: vehicule, kil: km, cond: conduc};
                            tableauUtil.push(ligne);
                        }                    
                    }
                    tableauUtil.sort(function (b, a) {
                        return a.kil - b.kil;
                    });
                    for (var i = 0; i < tableauUtil.length; i++) {
                        codeUtil += ("<tr><td>" + tableauUtil[i].vehi + "</td><td>" + tableauUtil[i].kil + " km</td><td>" + tableauUtil[i].cond + "</td></tr>");
                    }
                } else {
                    codeUtil = '<div class="breakafter"><h5>' + translate('Détails heures moteur') + ' :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="heuresMoteur">' + translate('Heures moteur') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                    for (var i=0; i<donneesRapport.heures.length; i++) {
                        var tps = (donneesRapport.heures[i].c[5]).split(":");
                        tps = (Number(tps[0]) * 3600) + (Number(tps[1]) * 60) + Number(tps[2]);
                        if (tps >= (($('#filtreHeuresMin').val() * 3600) + ($('#filtreMinutesMin').val() * 60)) && tps <= (($('#filtreHeuresMax').val() * 3600) + ($('#filtreMinutesMax').val() * 60))) {
                            var vehicule = donneesRapport.heures[i].c[0];                
                            var conduc = donneesRapport.heures[i].c[1];
                            if (conduc === "") {
                            conduc = translate('conducteur non renseigné');
                        } else if (conduc === "Drivers...") {
                            conduc = translate('conducteurs multiples');
                        }                
                            var ligne = {vehi: vehicule, temps: tps, cond: conduc};
                            tableauUtil.push(ligne);
                        }
                    }
                    tableauUtil.sort(function (b, a) {
                       return a.temps - b.temps; 
                    });
                    for (var i = 0; i < tableauUtil.length; i++) {
                        codeUtil += ("<tr><td>" + tableauUtil[i].vehi + "</td><td>" + prepareOperTime(tableauUtil[i].temps) + "</td><td>" + tableauUtil[i].cond + "</td></tr>");
                    }
                }                
                codeUtil += '</tbody></table></div>';
                
                //construction tableau pleins
                var tableauPleins = [];
                var codePleins = '<div class="breakafter"><h5>' + translate('Détails pleins') + ' :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="pleins">' + translate('Pleins') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                for (var i=0; i<donneesRapport.pleins.length; i++) { 
                    var plein = donneesRapport.pleins[i].c[1];
                    if (plein === "-----") {
                        plein = 0;
                    } else {
                        plein = Number(plein.replace(/ lt/i, ""));
                    }
                    if (plein >= $('#filtrePleinMin').val() && plein <= $('#filtrePleinMax').val()) {
                        var vehicule = donneesRapport.pleins[i].c[0];                    
                        var conduc = donneesRapport.pleins[i].c[2];
                        if (conduc === "") {
                            conduc = translate('conducteur non renseigné');
                        } else if (conduc === "Drivers...") {
                            conduc = translate('conducteurs multiples');
                        }
                        var ligne = {vehi: vehicule, pleins: plein, cond: conduc};
                        tableauPleins.push(ligne);
                    }                    
                }
                tableauPleins.sort(function (b, a) {
                    return a.pleins - b.pleins;
                });
                for (var i = 0; i < tableauPleins.length; i++) {
                    codePleins += ("<tr><td>" + tableauPleins[i].vehi + "</td><td>" + tableauPleins[i].pleins + " L</td><td>" + tableauPleins[i].cond + "</td></tr>");
                }
                codePleins += '</tbody></table></div>';
                
                //construction tableau vols
                var tableauVols = [];
                var codeVols = '<div class="breakafter"><h5>' + translate('Détails vols') + ' :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="vols">' + translate('Vols') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                for (var i=0; i<donneesRapport.vols.length; i++) {  
                    var vol = donneesRapport.vols[i].c[1];            
                    if (vol === "-----") {
                        vol = 0;
                    } else {
                        vol = Number(vol.replace(/ lt/i, ""));
                    }           
                    if (vol >= $('#filtreVolMin').val() && vol <= $('#filtreVolMax').val()) {
                        var vehicule = donneesRapport.vols[i].c[0];                    
                        var conduc = donneesRapport.vols[i].c[2];
                        if (conduc === "") {
                            conduc = translate('conducteur non renseigné');
                        } else if (conduc === "Drivers...") {
                            conduc = translate('conducteurs multiples');
                        }
                        var ligne = {vehi: vehicule, vols: vol, cond: conduc};
                        tableauVols.push(ligne);
                    }                    
                }
                tableauVols.sort(function (b, a) {
                    return a.vols - b.vols;
                });
                for (var i = 0; i < tableauVols.length; i++) {
                    codeVols += ("<tr><td>" + tableauVols[i].vehi + "</td><td>" + tableauVols[i].vols + " L</td><td>" + tableauVols[i].cond + "</td></tr>");
                }
                codeVols += '</tbody></table></div>';
                
                //construction tableau eco
                var tableauEco = [];
                var codeEco;
                if ($('#note').attr('checked')) {
                    codeEco = '<div class="breakafter"><h5>' + translate('Détails éco-impact') + ' :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="eco">' + translate('Note éco-conduite') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                    for (var i=0; i<donneesRapport.trajets.length; i++) {
                        var eco = donneesRapport.trajets[i].c[3];            
                        if (eco === "") {
                            eco = 0;
                        } else {
                            eco = Number(eco);
                        }            
                        if (eco >= $('#filtreNoteMin').val() && eco <= $('#filtreNoteMax').val()) {
                            var vehicule = donneesRapport.trajets[i].c[0];                    
                            var conduc = donneesRapport.trajets[i].c[4];
                            if (conduc === "") {
                                conduc = translate('conducteur non renseigné');
                            } else if (conduc === "Drivers...") {
                                conduc = translate('conducteurs multiples');
                            }
                            var ligne = {vehi: vehicule, note: eco, cond: conduc};
                            tableauEco.push(ligne);
                        }                    
                    }
                    tableauEco.sort(function (b, a) {
                        return a.note - b.note;
                    });
                    for (var i = 0; i < tableauEco.length; i++) {
                        codeEco += ("<tr><td>" + tableauEco[i].vehi + "</td><td>" + tableauEco[i].note + "</td><td>" + tableauEco[i].cond + "</td></tr>");
                    }
                } else {
                    var autreTab = [];
                    codeEco = '<div class="breakafter"><h5>' + translate('Détails éco-impact') + ' :</h5><table id="scheme-head"><thead id="tabhead"><tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="eco">' + translate('Rejets CO2') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr></thead><tbody id="tabbody">';
                    for (var i=0; i<donneesRapport.trajets.length; i++) {
                        var tps = (donneesRapport.heures[i].c[5]).split(":");
                        tps = (Number(tps[0]) * 3600) + (Number(tps[1]) * 60) + Number(tps[2]);
                        var consome = Number(donneesRapport.trajets[i].c[6].replace(/ lt/i, ""));
                        var vehicule = donneesRapport.trajets[i].c[0];                    
                        var coef;                        
                        if (~tabDiesel.indexOf(vehicule)) {
                            coef = 2.67;
                        } else if (~tabEssence.indexOf(vehicule)) {
                            coef = 2.28;
                        } else if (~tabGPL.indexOf(vehicule)) {
                            coef = 1.66;
                        } else {
                            coef = -1;
                        }
                        var co2 = consome*coef;
                        if (co2 >= $('#filtreCo2Min').val() && co2 <= $('#filtreCo2Max').val()) {
                            var conduc = donneesRapport.trajets[i].c[4];
                            if (conduc === "") {
                                conduc = translate('conducteur non renseigné');
                            } else if (conduc === "Drivers...") {
                                conduc = translate('conducteurs multiples');
                            }
                            var ligne = {vehi: vehicule, co2: co2, cond: conduc};
                            tableauEco.push(ligne);
                        } else if (co2<0) {
                            co2 = translate('carburant non renseigné');
                            var conduc = donneesRapport.trajets[i].c[4];
                            if (conduc === "") {
                                conduc = translate('conducteur non renseigné');
                            } else if (conduc === "Drivers...") {
                                conduc = translate('conducteurs multiples');
                            }
                            var ligne = {vehi: vehicule, co2: co2, cond: conduc};
                            autreTab.push(ligne);
                        }                                            
                    }                    
                    if (tableauEco.length) {
                        tableauEco.sort(function (b, a) {
                            return a.co2 - b.co2;
                        });
                        for (var i = 0; i < tableauEco.length; i++) {
                            codeEco += ("<tr><td>" + tableauEco[i].vehi + "</td><td>" + tableauEco[i].co2.toFixed(2) + " Kg</td><td>" + tableauEco[i].cond + "</td></tr>");
                        }
                    }                    
                    if (autreTab.length) {
                        autreTab.sort(function (b, a) {
                            return a.vehi - b.vehi; 
                        });
                        for (var i=0; i<autreTab.length; i++) {
                            codeEco += ("<tr><td>" + autreTab[i].vehi + "</td><td>" + autreTab[i].co2 + "</td><td>" + autreTab[i].cond + "</td></tr>");
                        }
                    }                    
                }                
                codeEco += '</tbody></table></div>';
                
		var beginCode = '<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="css/style.css"/>' +
					'</head><body>' +
					'<p style="text-align: right; font-size: 12px;">' + translate('Intervalle') + ' - ' + $('.iw-label', '#ranging-time-wrap').text() + '</p>' +
					'</br><h1 style="text-align: center;">' + translate('Tableau Consommation Carburant') + '</h1></br>' +
					'<p>' + translate('Flotte') + ' - ' + $('option:selected', $unitsGroup).text() + '</p>' +
					'<div class="content"><div class="wrap" style="width: 100%;">';
		
		var endCode = '</div></div></body></html>';


		resultCode = beginCode + '</br>' + codeTab + '</br>' + codeConso + '</br>' + codeAMT + '</br>' + codeUtil + '</br>' + codePleins + '</br>' + codeVols + '</br>' + codeEco + endCode;

		window_ = window.open('about:blank', 'Print', 'left=300,top=300,right=500,bottom=500,width=1000,height=500');

		window_.document.open();
		window_.document.write(resultCode);
		window_.document.close();

		setTimeout( function() {
			window_.focus();
			window_.print();
			window_.close();
		}, 500 );

		return this;
	}

        function ltranslate() {
		$btnprint.attr('title', translate('Imprimer'));
                $('#flotte').html(translate('Flotte') + ' :');
                $('#affFiltres').html(translate('Afficher les filtres'));
                $('.label-filtre', '#DfiltreConsoMax').html(translate('conso max') + ' : ');
                $('.label-filtre', '#DfiltreConsoMin').html(translate('conso min') + ' : ');
                $('.label-filtre', '#DfiltreConsoAMTMax').html(translate('conso AMT max') + ' : ');
                $('.label-filtre', '#DfiltreConsoAMTMin').html(translate('conso AMT min') + ' : ');
                $('.label-filtre', '#DfiltreKiloMax').html(translate('kilométrage max') + ' : ');
                $('.label-filtre', '#DfiltreKiloMin').html(translate('kilométrage min') + ' : ');
                $('.label-filtre', '#DfiltreHeuresMax').html(translate('temps max') + ' (h:m) : ');
                $('.label-filtre', '#DfiltreHeuresMin').html(translate('temps min') + ' (h:m) : ');
                $('.label-filtre', '#DfiltrePleinMax').html(translate('plein max') + ' : ');
                $('.label-filtre', '#DfiltrePleinMin').html(translate('plein min') + ' : ');
                $('.label-filtre', '#DfiltreVolMax').html(translate('vol max') + ' : ');
                $('.label-filtre', '#DfiltreVolMin').html(translate('vol min') + ' : ');
                $('.label-filtre', '#DfiltreNoteMax').html(translate('note max') + ' : ');
                $('.label-filtre', '#DfiltreNoteMin').html(translate('note min') + ' : ');
                $('.label-filtre', '#DfiltreCo2Max').html(translate('co2 max') + ' : ');
                $('.label-filtre', '#DfiltreCo2Min').html(translate('co2 min') + ' : ');
		$('#sourceConso i').html(translate('Source de la consommation') + ' : ');
                $('#titreConso').html(translate('Consommation globale'));
                $('.label-unite', '#uniteConso').html(translate('Unité de consommation') + ' : ');
                $('#titreConsoAMT').html(translate('Consommation arrêt moteur tournant'));
                $('#titreUtilisation').html(translate('Utilisation'));
                $('#labKm').html(translate('Kilométrage'));
                $('#labH').html(translate('Heures moteur'));
                $('#titrePleins').html(translate('Pleins'));
                $('#titreVols').html(translate('Vols carburant'));
                $('#titreEco').html(translate('Eco-impact'));
                $('#labCo2').html(translate('Rejets CO2'));
                $('#labNote').html(translate('Eco-conduite'));
                $('#ancre').html('</br>' + translate('Détails') + ' :');
	}
        
        function translate(txt){
		var result = txt;
		if (typeof TRANSLATIONS !== "undefined" && typeof TRANSLATIONS === "object" && TRANSLATIONS[txt]) {
			result = TRANSLATIONS[txt];
		}
		return result;
	}

	/** GET URL PARAMETERS */
	function getHtmlVar(name) {
		if (!name) {
			return null;
		}
		var pairs = document.location.search.substr(1).split("&");
		for (var i = 0; i < pairs.length; i++) {
			var pair = pairs[i].split("=");
			if (decodeURIComponent(pair[0]) === name) {
				var param = decodeURIComponent(pair[1]);
				param = param.replace(/[?]/g, '');
				return param;
			}
		}
		return null;
	}
        
        function init() {// Execute after login succeed
            // specify what kind of data should be returned
            var res_flags = wialon.item.Item.dataFlag.base | wialon.item.Resource.dataFlag.reports;
            var unit_flags = wialon.item.Item.dataFlag.base;

            var sess = wialon.core.Session.getInstance(); // get instance of current Session
            //sess.loadLibrary("unitEvents"); 
            sess.loadLibrary("resourceReports"); // load Reports Library
            sess.updateDataFlags( // load items to current session
                    [{type: "type", data: "avl_resource", flags:res_flags , mode: 0}, // 'avl_resource's specification
                     {type: "type", data: "avl_unit_group", flags: unit_flags, mode: 0}], // 'avl_unit's specification
                    function (code) { // updateDataFlags callback
                            
                            var res = sess.getItems("avl_resource"); // get loaded 'avl_resource's items
                            if (!res || !res.length){ msg("Resources not found"); return; } // check if resources found
                            for (var i = 0; i< res.length; i++) // construct Select object using found resources
                                    $("#res").append("<option value='" + res[i].getId() + "'>" + res[i].getName() + "</option>");

                            var units = sess.getItems("avl_unit_group"); // get loaded 'avl_units's items
                            if (!units || !units.length){ msg("Units not found"); return; } // check if units found
                            var select = '<option disabled="disabled" selected>' + translate('Choisir la flotte') + '</option>';
                            for (var i = 0; i< units.length; i++) { // construct Select object using found units 
                                select += ("<option value='"+ units[i].getId() +"'>"+ units[i].getName()+ "</option>");
                            }   
                            $("#units-group").html(select);
                    }
            );
        }
        
        function executeReport(){ // execute selected report
            // get data from corresponding fields
                var id_templ=null, id_unit=$("#units-group").val();
                if(!id_unit){ msg("Select unit"); return;} // exit if no unit selected

                var sess = wialon.core.Session.getInstance(); // get instance of current Session
                var res = sess.getItems("avl_resource"); // get resource by id
                res = res[0];
                var rapport = res.$$user_reports;
                var nb = 1;
                while (!id_templ) {
                    if (rapport[nb]) {
                        var nom = rapport[nb].n; 
                        if (nom === "Rapport App Conso Flotte") {
                            id_templ = rapport[nb].id;
                        } else nb++;
                    } else nb++;                   
                }
                
                var to = currentInterval[1]; // get current server time (end time of report time interval)
                var from = currentInterval[0]; // calculate start time of report
                // specify time interval object
                var interval = { "from": from, "to": to, "flags": wialon.item.MReport.intervalFlag.absolute };
                var template = res.getReport(id_templ); // get report template by id

                res.execReport(template, id_unit, 0, interval, // execute selected report
                        function(code, data) { // execReport template
                                if(code){ msg(wialon.core.Errors.getErrorText(code)); return; } // exit if error code
                                if(!data.getTables().length){ // exit if no tables obtained
                                        msg("<b>There is no data generated</b>"); return; }
                                else showReportResult(data); // show report result
                });
        }

        function showReportResult(result){ // show result after report execute
                var tables = result.getTables(); // get report tables
                if (!tables) return; // exit if no tables
                var cptReq = 0;
                var cptRep = 0;
                for(var i=0; i < tables.length; i++){ // cycle on tables
                                                                     
                        // html contains information about one table
                        var html = "";
                                                
                        result.getTableRows(i, 0, tables[i].rows, // get Table rows
                                qx.lang.Function.bind( function(html, code, rows) { // getTableRows callback
                                        if (code) {msg(wialon.core.Errors.getErrorText(code)); return;} // exit if error code
                                        
                                        for(var j in rows) { // cycle on table rows
                                                if (typeof rows[j].c === "undefined") continue; // skip empty rows                                                
                                        }
                                        if (rows[0].c.length === 3) {
                                            donneesRapport.vols = rows;
                                            for (var k=0; k<rows.length; k++) {
                                                if (rows[k].t1!==0) {
                                                    cptReq++;
                                                    result.getRowDetail(3, k, function(cod, col) {
                                                        if (cod) {
                                                            msg(wialon.core.Errors.getErrorText(cod));
                                                        } else {
                                                            if (!details.vols) {
                                                                details.vols = [{vehi: col[0].c[0], lignes: col}];
                                                            } else {
                                                                details.vols.push({vehi: col[0].c[0], lignes: col});
                                                            }
                                                        }
                                                        cptRep++;
                                                        if (donneesRapport.trajets && donneesRapport.pleins && donneesRapport.heures && donneesRapport.vols && cptRep===cptReq) {
                                                            afficherDonnees();
                                                        }
                                                    });
                                                } else {
                                                    if (!details.vols) {
                                                        details.vols = [{vehi: rows[k].c[0]}];
                                                    } else {
                                                        details.vols.push({vehi: rows[k].c[0]});
                                                    }
                                                }
                                            }
                                        } else if (rows[0].c.length === 6) {
                                            donneesRapport.heures = rows;
                                            for (var k=0; k<rows.length; k++) {
                                                if (rows[k].t1!==0) {
                                                    cptReq++;
                                                    result.getRowDetail(2, k, function(cod, col) {
                                                        if (cod) {
                                                            msg(wialon.core.Errors.getErrorText(cod));
                                                        } else {
                                                            if (!details.heures) {
                                                                details.heures = [{vehi: col[0].c[0], lignes: col}];
                                                            } else {
                                                                details.heures.push({vehi: col[0].c[0], lignes: col});
                                                            }
                                                        }
                                                        cptRep++;
                                                        if (donneesRapport.trajets && donneesRapport.pleins && donneesRapport.heures && donneesRapport.vols && cptRep===cptReq) {
                                                            afficherDonnees();
                                                        }
                                                    });
                                                } else {
                                                    if (!details.heures) {
                                                        details.heures = [{vehi: rows[k].c[0]}];
                                                    } else {
                                                        details.heures.push({vehi: rows[k].c[0]});
                                                    }
                                                }
                                            }
                                        } else if (rows[0].c.length === 4) {
                                            donneesRapport.pleins = rows;
                                            for (var k=0; k<rows.length; k++) {
                                                if (rows[k].t1!==0) {
                                                    cptReq++;
                                                    result.getRowDetail(1, k, function(cod, col) {                                                        
                                                        if (cod) {
                                                            msg(wialon.core.Errors.getErrorText(cod));
                                                        } else {
                                                            if (!details.pleins) {
                                                                details.pleins = [{vehi: col[0].c[0], lignes: col}];
                                                            } else {
                                                                details.pleins.push({vehi: col[0].c[0], lignes: col});
                                                            }
                                                        }
                                                        cptRep++;
                                                        if (donneesRapport.trajets && donneesRapport.pleins && donneesRapport.heures && donneesRapport.vols && cptRep===cptReq) {
                                                            afficherDonnees();
                                                        }
                                                    });
                                                } else {
                                                    if (!details.pleins) {
                                                        details.pleins = [{vehi: rows[k].c[0]}];
                                                    } else {
                                                        details.pleins.push({vehi: rows[k].c[0]});
                                                    }
                                                }
                                            }
                                        } else if (rows[0].c.length === 7) {
                                            donneesRapport.trajets = rows;
                                            for (var k=0; k<rows.length; k++) {
                                                if (rows[k].t1!==0) {
                                                    cptReq++;
                                                    result.getRowDetail(0, k, function(cod, col) {
                                                        if (cod) {
                                                            msg(wialon.core.Errors.getErrorText(cod));
                                                        } else {
                                                            if (!details.trajets) {
                                                                details.trajets = [{vehi: col[0].c[0], lignes: col}];
                                                            } else {
                                                                details.trajets.push({vehi: col[0].c[0], lignes: col});
                                                            }
                                                        }
                                                        cptRep++;
                                                        if (donneesRapport.trajets && donneesRapport.pleins && donneesRapport.heures && donneesRapport.vols && cptRep===cptReq) {
                                                            afficherDonnees();
                                                        }
                                                    });
                                                } else {
                                                    if (!details.trajets) {
                                                        details.trajets = [{vehi: rows[k].c[0]}];
                                                    } else {
                                                        details.trajets.push({vehi: rows[k].c[0]});
                                                    }
                                                }
                                            }
                                        }                                       
                                }, this, html)
                        );
                }                
        }

        function afficherDonnees() {
            
            details.heures.sort(sortByName);
            details.pleins.sort(sortByName);
            details.trajets.sort(sortByName);
            details.vols.sort(sortByName);
            
            for (var i=0; i<donneesRapport.heures.length; i++) {
                if (details.heures[i].lignes) {
                    donneesRapport.heures[i].details = details.heures[i].lignes;
                }
                if (details.pleins[i].lignes) {
                    donneesRapport.pleins[i].details = details.pleins[i].lignes;
                }
                if (details.trajets[i].lignes) {
                    donneesRapport.trajets[i].details = details.trajets[i].lignes;
                }
                if (details.vols[i].lignes) {
                    donneesRapport.vols[i].details = details.vols[i].lignes;
                }
            }
            
            
            var consoGlobKmMoyFLS = 0;
            var consoGlobKmMaxFLS = 0;
            var consoGlobKmMinFLS = 1000;
            var cptConsoGlobKmFLS = 0;
            
            var consoGlobHeureMoyFLS = 0;
            var consoGlobHeureMaxFLS = 0;
            var consoGlobHeureMinFLS = 1000;
            var cptConsoGlobHeureFLS = 0;
            
            var consoGlobKmMoyCAN = 0;
            var consoGlobKmMaxCAN = 0;
            var consoGlobKmMinCAN = 1000;
            var cptConsoGlobKmCAN = 0;
            
            var consoGlobHeureMoyCAN = 0;
            var consoGlobHeureMaxCAN = 0;
            var consoGlobHeureMinCAN = 1000;
            var cptConsoGlobHeureCAN = 0;
            
            var consoAMTTot = 0;
            var consoAMTMax = 0;
            var consoAMTMin = 1000;
            var cptConsoAMT = 0;
            
            var kilometrageTot = 0;
            var kilometrageMax = 0;
            var kilometrageMin = 10000;
            var cptKilometrage = 0;
            
            var heureTot = 0;
            var heureMax = 0;
            var heureMin = 2700000;
            var cptHeure = 0;
            
            var pleinTot = 0;
            var pleinMax = 0;
            var pleinMin = 5000;
            var cptPlein = 0;
            
            var volTot = 0;
            var volMax = 0;
            var volMin = 5000;
            var cptVol = 0;
            
            var noteMoy = 0;
            var noteMax = 0;
            var noteMin = 6;
            var cptNote = 0;
            
            var co2Tot = 0;
            var co2Max = 0;
            var co2Min = 5000000;
            var cptCo2 = 0;
                                    
            for (var i=0; i<donneesRapport.trajets.length; i++) {
                
                var consoKmFLS = Number(((donneesRapport.trajets[i].c[2]).split(" "))[0]);
                if (consoKmFLS >= $('#filtreConsoMin').val() && consoKmFLS <= $('#filtreConsoMax').val()) {
                    consoGlobKmMoyFLS += consoKmFLS;
                    cptConsoGlobKmFLS++;
                    if (consoKmFLS>consoGlobKmMaxFLS) {
                        consoGlobKmMaxFLS = consoKmFLS;
                    }
                    if (consoKmFLS<consoGlobKmMinFLS) {
                        consoGlobKmMinFLS = consoKmFLS;
                    }                    
                }
                
                var consoHeureFLS = Number(((donneesRapport.heures[i].c[3]).split(" "))[0]);
                if (consoHeureFLS >= $('#filtreConsoMin').val() && consoHeureFLS <= $('#filtreConsoMax').val()) {
                    consoGlobHeureMoyFLS += consoHeureFLS;
                    cptConsoGlobHeureFLS++;
                    if (consoHeureFLS>consoGlobHeureMaxFLS) {
                        consoGlobHeureMaxFLS = consoHeureFLS;
                    }
                    if (consoHeureFLS<consoGlobHeureMinFLS) {
                        consoGlobHeureMinFLS = consoHeureFLS;
                    }                    
                }
                
                var consoKmCAN = Number(((donneesRapport.trajets[i].c[5]).split(" "))[0]);
                if (consoKmCAN >= $('#filtreConsoMin').val() && consoKmCAN <= $('#filtreConsoMax').val()) {
                    consoGlobKmMoyCAN += consoKmCAN;
                    cptConsoGlobKmCAN++;
                    if (consoKmCAN>consoGlobKmMaxCAN) {
                        consoGlobKmMaxCAN = consoKmCAN;
                    }
                    if (consoKmCAN<consoGlobKmMinCAN) {
                        consoGlobKmMinCAN = consoKmCAN;
                    }                    
                }
                
                var consoHeureCAN = Number(((donneesRapport.heures[i].c[4]).split(" "))[0]);
                if (consoHeureCAN >= $('#filtreConsoMin').val() && consoHeureCAN <= $('#filtreConsoMax').val()) {
                    consoGlobHeureMoyCAN += consoHeureCAN;
                    cptConsoGlobHeureCAN++;
                    if (consoHeureCAN>consoGlobHeureMaxCAN) {
                        consoGlobHeureMaxCAN = consoHeureCAN;
                    }
                    if (consoHeureCAN<consoGlobHeureMinCAN) {
                        consoGlobHeureMinCAN = consoHeureCAN;
                    }                    
                }
                
                var consoAMT = Number((donneesRapport.heures[i].c[2]).replace(/ lt/i, ""));
                if (consoAMT >= $('#filtreConsoAMTMin').val() && consoAMT <= $('#filtreConsoAMTMax').val()) {
                    consoAMTTot += consoAMT;
                    cptConsoAMT++;
                    if (consoAMT > consoAMTMax) {
                        consoAMTMax = consoAMT;
                    }
                    if (consoAMT < consoAMTMin) {
                        consoAMTMin = consoAMT;
                    }
                }                
                
                var km = Number((donneesRapport.trajets[i].c[1]).replace(/ km/i, ""));
                if (km >= $('#filtreKiloMin').val() && km <= $('#filtreKiloMax').val()) {
                    kilometrageTot += km;
                    cptKilometrage++;
                    if (km > kilometrageMax) {
                        kilometrageMax = km;
                    }
                    if (km < kilometrageMin) {
                        kilometrageMin = km;
                    }
                }
                
                var tps = (donneesRapport.heures[i].c[5]).split(":");
                tps = (Number(tps[0]) * 3600) + (Number(tps[1]) * 60) + Number(tps[2]);
                if (tps >= (($('#filtreHeuresMin').val() * 3600) + ($('#filtreMinutesMin').val() * 60)) && tps <= (($('#filtreHeuresMax').val() * 3600) + ($('#filtreMinutesMax').val() * 60))) {
                    heureTot += tps;
                    cptHeure++;
                    if (tps > heureMax) {
                        heureMax = tps;
                    }
                    if (tps < heureMin) {
                        heureMin = tps;
                    }
                }
                
                var plein = donneesRapport.pleins[i].c[1];
                if (plein === "-----") {
                    plein = 0;
                } else {
                    plein = Number(plein.replace(/ lt/i, ""));
                }
                if (plein >= $('#filtrePleinMin').val() && plein <= $('#filtrePleinMax').val()) {
                    pleinTot += plein;
                    cptPlein++;
                    if (plein > pleinMax) {
                        pleinMax = plein;
                    }
                    if (plein < pleinMin) {
                        pleinMin = plein;
                    }
                }                
                
                var vol = donneesRapport.vols[i].c[1];            
                if (vol === "-----") {
                    vol = 0;
                } else {
                    vol = Number(vol.replace(/ lt/i, ""));
                }           
                if (vol >= $('#filtreVolMin').val() && vol <= $('#filtreVolMax').val()) {
                    volTot += vol;
                    cptVol++;
                    if (vol > volMax) {
                        volMax = vol;
                    }
                    if (vol < volMin) {
                        volMin = vol;
                    }
                }                
                
                var note = donneesRapport.trajets[i].c[3];            
                if (note === "") {
                    note = 0;
                } else {
                    note = Number(note);
                }            
                if (note >= $('#filtreNoteMin').val() && note <= $('#filtreNoteMax').val()) {
                    noteMoy += note;
                    cptNote++;
                    if (note > noteMax) {
                        noteMax = note;
                    }
                    if (note < noteMin) {
                        noteMin = note;
                    }
                }
                
                var co2 = Number(donneesRapport.trajets[i].c[6].replace(/ lt/i, ""));
                var vehicule = donneesRapport.trajets[i].c[0];
                var coef;                        
                if (~tabDiesel.indexOf(vehicule)) {
                    coef = 2.67;
                } else if (~tabEssence.indexOf(vehicule)) {
                    coef = 2.28;
                } else if (~tabGPL.indexOf(vehicule)) {
                    coef = 1.66;
                } else {
                    coef = -1;
                }
                co2 = co2*coef;
                if (co2 >= $('#filtreCo2Min').val() && co2 <= $('#filtreCo2Max').val()) {
                    co2Tot+=co2;
                    cptCo2++;
                    if (co2 > co2Max) {
                        co2Max = co2;
                    }
                    if (co2 < co2Min) {
                        co2Min = co2;
                    }
                }
            }
            
            var strConsoGlobKmMoyFLS;
            var strConsoGlobKmMaxFLS;
            var strConsoGlobKmMinFLS;
            if (cptConsoGlobKmFLS === 0) {
                strConsoGlobKmMoyFLS = translate('Pas de données');
                strConsoGlobKmMaxFLS = translate('Pas de données');
                strConsoGlobKmMinFLS = translate('Pas de données');
            } else {
                consoGlobKmMoyFLS = consoGlobKmMoyFLS/cptConsoGlobKmFLS;
                consoGlobKmMoyFLS = consoGlobKmMoyFLS.toFixed(2);            
                strConsoGlobKmMoyFLS = translate('Moy') + ' : ' + consoGlobKmMoyFLS + " L/100km";
                strConsoGlobKmMaxFLS = "Max : " + consoGlobKmMaxFLS + " L/100km";
                strConsoGlobKmMinFLS = "Min : " + consoGlobKmMinFLS + " L/100km";
            }
            
            var strConsoGlobHeureMoyFLS;
            var strConsoGlobHeureMaxFLS;
            var strConsoGlobHeureMinFLS;
            if (cptConsoGlobHeureFLS === 0) {
                strConsoGlobHeureMoyFLS = translate('Pas de données');
                strConsoGlobHeureMaxFLS = translate('Pas de données');
                strConsoGlobHeureMinFLS = translate('Pas de données');
            } else {
                consoGlobHeureMoyFLS = consoGlobHeureMoyFLS/cptConsoGlobHeureFLS;
                consoGlobHeureMoyFLS = consoGlobHeureMoyFLS.toFixed(2);            
                strConsoGlobHeureMoyFLS = translate('Moy') + ' : ' + consoGlobHeureMoyFLS + " L/h";
                strConsoGlobHeureMaxFLS = "Max : " + consoGlobHeureMaxFLS + " L/h";
                strConsoGlobHeureMinFLS = "Min : " + consoGlobHeureMinFLS + " L/h";
            }
            
            var strConsoGlobKmMoyCAN;
            var strConsoGlobKmMaxCAN;
            var strConsoGlobKmMinCAN;
            if (cptConsoGlobKmCAN === 0) {
                strConsoGlobKmMoyCAN = translate('Pas de données');
                strConsoGlobKmMaxCAN = translate('Pas de données');
                strConsoGlobKmMinCAN = translate('Pas de données');
            } else {
                consoGlobKmMoyCAN = consoGlobKmMoyCAN/cptConsoGlobKmCAN;
                consoGlobKmMoyCAN = consoGlobKmMoyCAN.toFixed(2);            
                strConsoGlobKmMoyCAN = translate('Moy') + ' : ' + consoGlobKmMoyCAN + " L/100km";
                strConsoGlobKmMaxCAN = "Max : " + consoGlobKmMaxCAN + " L/100km";
                strConsoGlobKmMinCAN = "Min : " + consoGlobKmMinCAN + " L/100km";
            }
            
            var strConsoGlobHeureMoyCAN;
            var strConsoGlobHeureMaxCAN;
            var strConsoGlobHeureMinCAN;
            if (cptConsoGlobHeureCAN === 0) {
                strConsoGlobHeureMoyCAN = translate('Pas de données');
                strConsoGlobHeureMaxCAN = translate('Pas de données');
                strConsoGlobHeureMinCAN = translate('Pas de données');
            } else {
                consoGlobHeureMoyCAN = consoGlobHeureMoyCAN/cptConsoGlobHeureCAN;
                consoGlobHeureMoyCAN = consoGlobHeureMoyCAN.toFixed(2);            
                strConsoGlobHeureMoyCAN = translate('Moy') + ' : ' + consoGlobHeureMoyCAN + " L/h";
                strConsoGlobHeureMaxCAN = "Max : " + consoGlobHeureMaxCAN + " L/h";
                strConsoGlobHeureMinCAN = "Min : " + consoGlobHeureMinCAN + " L/h";
            }            
            
            var strConsoAMTTot;
            var strConsoAMTMax;
            var strConsoAMTMin;
            if (cptConsoAMT === 0) {
                strConsoAMTTot = translate('Pas de données');
                strConsoAMTMax = translate('Pas de données');
                strConsoAMTMin = translate('Pas de données');
            } else {
                consoAMTTot = consoAMTTot.toFixed(2);
                strConsoAMTTot = "Tot : " + consoAMTTot + " L";
                strConsoAMTMax = "Max : " + consoAMTMax + " L";
                strConsoAMTMin = "Min : " + consoAMTMin + " L";
            }
            
            var strKmTot;
            var strKmMax;
            var strKmMin;  
            if (cptKilometrage === 0) {
                strKmTot = translate('Pas de données');
                strKmMax = translate('Pas de données');
                strKmMin = translate('Pas de données');
            } else {
                kilometrageTot = kilometrageTot.toFixed(1);            
                strKmTot = "Tot : " + kilometrageTot + " km";
                strKmMax = "Max : " + kilometrageMax + " km";
                strKmMin = "Min : " + kilometrageMin + " km";
            }
            
            var strHeureTot;
            var strHeureMax;
            var strHeureMin;  
            if (cptHeure === 0) {
                strHeureTot = translate('Pas de données');
                strHeureMax = translate('Pas de données');
                strHeureMin = translate('Pas de données');
            } else {            
                strHeureTot = "Tot : " + prepareOperTime(heureTot);
                strHeureMax = "Max : " + prepareOperTime(heureMax);
                strHeureMin = "Min : " + prepareOperTime(heureMin);
            }
            
            var strPleinTot;
            var strPleinMax;
            var strPleinMin;
            if (cptPlein === 0) {
                strPleinTot = translate('Pas de données');
                strPleinMax = translate('Pas de données');
                strPleinMin = translate('Pas de données');
            } else {
                strPleinTot = "Tot : " + pleinTot.toFixed(2) + " L";
                strPleinMax = "Max : " + pleinMax + " L";
                strPleinMin = "Min : " + pleinMin + " L";
            }
            
            if (cptVol === 0) {
                var strVolTot = translate('Pas de données');
                var strVolMax = translate('Pas de données');
                var strVolMin = translate('Pas de données');
            } else {
                volTot = volTot.toFixed(2);
                var strVolTot = "Tot : " + volTot + " L";
                var strVolMax = "Max : " + volMax + " L";
                var strVolMin = "Min : " + volMin + " L";
            }
            
            if (cptNote === 0) {
                var strNoteMoy = translate('Pas de données');
                var strNoteMax = translate('Pas de données');
                var strNoteMin = translate('Pas de données');
            } else {
                noteMoy = noteMoy/cptNote;
                noteMoy = noteMoy.toFixed(1); 
                var strNoteMoy = translate('Moy') + ' : ' + noteMoy;
                var strNoteMax = "Max : " + noteMax;
                var strNoteMin = "Min : " + noteMin;
            }
            
            if (cptCo2 === 0) {
                var strCo2Moy = translate('Pas de données');
                var strCo2Max = translate('Pas de données');
                var strCo2Min = translate('Pas de données');
            } else {
                var strCo2Moy = "Tot : " + co2Tot.toFixed(2) + " Kg";
                var strCo2Max = "Max : " + co2Max.toFixed(2) + " Kg";
                var strCo2Min = "Min : " + co2Min.toFixed(2) + " Kg";
            }
            
            
            if ($('#sonde').attr('checked')) {
                if ($('#litreKm').attr('checked')) {
                    $("#consoMoy").text(strConsoGlobKmMoyFLS);
                    $("#consoMax").text(strConsoGlobKmMaxFLS);
                    $("#consoMin").text(strConsoGlobKmMinFLS);
                } else {
                    $("#consoMoy").text(strConsoGlobHeureMoyFLS);
                    $("#consoMax").text(strConsoGlobHeureMaxFLS);
                    $("#consoMin").text(strConsoGlobHeureMinFLS);
                }
            } else {
                if ($('#litreKm').attr('checked')) {
                    $("#consoMoy").text(strConsoGlobKmMoyCAN);
                    $("#consoMax").text(strConsoGlobKmMaxCAN);
                    $("#consoMin").text(strConsoGlobKmMinCAN);
                } else {
                    $("#consoMoy").text(strConsoGlobHeureMoyCAN);
                    $("#consoMax").text(strConsoGlobHeureMaxCAN);
                    $("#consoMin").text(strConsoGlobHeureMinCAN);
                }
            }                      
            
            $("#consoAMTTot").text(strConsoAMTTot);
            $("#consoAMTMax").text(strConsoAMTMax);
            $("#consoAMTMin").text(strConsoAMTMin);
            
            if ($('#kilometrage').attr('checked')) {
                $("#utilisationTot").text(strKmTot);
                $("#utilisationMax").text(strKmMax);
                $("#utilisationMin").text(strKmMin);
            } else {
                $("#utilisationTot").text(strHeureTot);
                $("#utilisationMax").text(strHeureMax);
                $("#utilisationMin").text(strHeureMin);
            }
            
            $("#pleinTot").text(strPleinTot);
            $("#pleinMax").text(strPleinMax);
            $("#pleinMin").text(strPleinMin);
            
            $("#volTot").text(strVolTot);
            $("#volMax").text(strVolMax);
            $("#volMin").text(strVolMin);
            
            if ($('#note').attr('checked')) {
                $("#ecoMoy").text(strNoteMoy);
                $("#ecoMax").text(strNoteMin);
                $("#ecoMin").text(strNoteMax);
            } else {
                $("#ecoMoy").text(strCo2Moy);
                $("#ecoMax").text(strCo2Max);
                $("#ecoMin").text(strCo2Min);
            }
            
            
            $('#loader').hide();
        }
               
        function msg(text) { $("#log").prepend(text + "<br/>"); }
        
        function afficheDetailsConsoKmFLS() {            
            var tableau =[];            
            var code = [];
            
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="conso">' + translate('Consommation') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');

            for (var i=0; i<donneesRapport.trajets.length; i++) {
                var conso = Number(((donneesRapport.trajets[i].c[2]).split(" "))[0]);                
                if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                    var vehicule = donneesRapport.trajets[i].c[0];
                    var conduc = donneesRapport.trajets[i].c[4];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    if (!donneesRapport.trajets[i].details) {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc, details: donneesRapport.trajets[i].details};
                    }                    
                    tableau.push(ligne);
                }                
            }            
            tableau.sort(function (b, a) {
               return a.cons - b.cons; 
            }); 
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "KmFlsId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "KmFlsClass" + tableau[i].vehi.replace(/ /g, "");                    
                    var cpt = 0;
                    var tab1 = [];
                    var tab2 = [];
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var cons = Number(tableau[i].details[j].c[2].split(" ")[0]);
                        if (cons!==0) {
                            cpt++;
                            var conduc = tableau[i].details[j].c[4];
                            if (conduc === "") {
                                conduc = "conducteur non renseigné";
                            }
                            var date = new Date(tableau[i].details[j].t1 * 1000);
                            var year = date.getFullYear();
                            var month = date.getMonth()+1;
                            if (month<10) {
                                month = "0" + month;
                            }
                            var day = date.getDate();
                            if (day<10) {
                                day = "0" + day;
                            }
                            var hour = date.getHours();
                            if (hour<10) {
                                hour = "0" + hour;
                            }
                            var minute = date.getMinutes();
                            if (minute<10) {
                                minute = "0" + minute;
                            }
                            var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                            tab2.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[2].split(" ")[0] + " L/100km</td><td>" + conduc + "</td></tr>");
                        }                        
                    }
                    if ((cpt % 2)!==0) {
                        tab2.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                    tab1.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + cpt + ")</strong></a></td><td><strong>" + tableau[i].cons + " L/100km</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    if (cpt!==0) {
                        code.push(tab1 + tab2);
                        tabName.push(idTr);
                    } else {
                        code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/100km</td><td>" + tableau[i].cond + "</td></tr>");
                    }
                } else {
                     code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/100km</td><td>" + tableau[i].cond + "</td></tr>");
                }
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
        
        function afficheDetailsConsoHeureFLS() {            
            var tableau =[];            
            var code = [];
            
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="conso">' + translate('Consommation') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');

            for (var i=0; i<donneesRapport.heures.length; i++) {
                var conso = Number(((donneesRapport.heures[i].c[3]).split(" "))[0]);                
                if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                    var vehicule = donneesRapport.heures[i].c[0];
                    var conduc = donneesRapport.heures[i].c[1];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    if (!donneesRapport.heures[i].details) {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc, details: donneesRapport.heures[i].details};
                    }                    
                    tableau.push(ligne);
                }                
            }            
            tableau.sort(function (b, a) {
               return a.cons - b.cons; 
            });
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "HFlsId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "HFlsClass" + tableau[i].vehi.replace(/ /g, "");
                    var cpt = 0;
                    var tab1 = [];
                    var tab2 = [];
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var cons = Number(tableau[i].details[j].c[3].split(" ")[0]);
                        if (cons!==0) {
                            cpt++;
                            var conduc = tableau[i].details[j].c[1];
                            if (conduc === "") {
                                conduc = "conducteur non renseigné";
                            }
                            var date = new Date(tableau[i].details[j].t1 * 1000);
                            var year = date.getFullYear();
                            var month = date.getMonth()+1;
                            if (month<10) {
                                month = "0" + month;
                            }
                            var day = date.getDate();
                            if (day<10) {
                                day = "0" + day;
                            }
                            var hour = date.getHours();
                            if (hour<10) {
                                hour = "0" + hour;
                            }
                            var minute = date.getMinutes();
                            if (minute<10) {
                                minute = "0" + minute;
                            }
                            var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                            tab2.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[3].split(" ")[0] + " L/h</td><td>" + conduc + "</td></tr>");
                        }                        
                    }
                    if ((cpt % 2)!==0) {
                        tab2.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                    tab1.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + cpt + ")</strong></a></td><td><strong>" + tableau[i].cons + " L/h</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    if (cpt!==0) {
                        code.push(tab1 + tab2);
                        tabName.push(idTr);
                    } else {
                        code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/h</td><td>" + tableau[i].cond + "</td></tr>");
                    }                    
                } else {
                     code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/h</td><td>" + tableau[i].cond + "</td></tr>");
                }
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
        
        function afficheDetailsConsoKmCAN() {            
            var tableau =[];            
            var code = [];
            
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="conso">' + translate('Consommation') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');

            for (var i=0; i<donneesRapport.trajets.length; i++) {
                var conso = Number(((donneesRapport.trajets[i].c[5]).split(" "))[0]);                
                if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                    var vehicule = donneesRapport.trajets[i].c[0];
                    var conduc = donneesRapport.trajets[i].c[4];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    if (!donneesRapport.trajets[i].details) {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc, details: donneesRapport.trajets[i].details};
                    }                    
                    tableau.push(ligne);
                }                
            }            
            tableau.sort(function (b, a) {
               return a.cons - b.cons; 
            });
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "KmCanId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "KmCanClass" + tableau[i].vehi.replace(/ /g, "");                    
                    var cpt = 0;
                    var tab1 = [];
                    var tab2 = [];
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var cons = Number(tableau[i].details[j].c[5].split(" ")[0]);
                        if (cons!==0) {
                            cpt++;
                            var conduc = tableau[i].details[j].c[4];
                            if (conduc === "") {
                                conduc = "conducteur non renseigné";
                            }
                            var date = new Date(tableau[i].details[j].t1 * 1000);
                            var year = date.getFullYear();
                            var month = date.getMonth()+1;
                            if (month<10) {
                                month = "0" + month;
                            }
                            var day = date.getDate();
                            if (day<10) {
                                day = "0" + day;
                            }
                            var hour = date.getHours();
                            if (hour<10) {
                                hour = "0" + hour;
                            }
                            var minute = date.getMinutes();
                            if (minute<10) {
                                minute = "0" + minute;
                            }
                            var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                            tab2.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[5].split(" ")[0] + " L/100km</td><td>" + conduc + "</td></tr>");
                        }                        
                    }
                    if ((cpt % 2)!==0) {
                        tab2.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                    tab1.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + cpt + ")</strong></a></td><td><strong>" + tableau[i].cons + " L/h</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    if (cpt!==0) {
                        code.push(tab1 + tab2);
                        tabName.push(idTr);
                    } else {
                        code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/100km</td><td>" + tableau[i].cond + "</td></tr>");
                    }
                } else {
                     code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/100km</td><td>" + tableau[i].cond + "</td></tr>");
                }
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
        
        function afficheDetailsConsoHeureCAN() {            
            var tableau =[];            
            var code = [];
            
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="conso">' + translate('Consommation') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');

            for (var i=0; i<donneesRapport.heures.length; i++) {
                var conso = Number(((donneesRapport.heures[i].c[4]).split(" "))[0]);                
                if (conso >= $('#filtreConsoMin').val() && conso <= $('#filtreConsoMax').val()) {
                    var vehicule = donneesRapport.heures[i].c[0];
                    var conduc = donneesRapport.heures[i].c[1];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    if (!donneesRapport.heures[i].details) {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, cons: conso, cond: conduc, details: donneesRapport.heures[i].details};
                    }
                    tableau.push(ligne);
                }                
            }            
            tableau.sort(function (b, a) {
               return a.cons - b.cons; 
            });    
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "HCanId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "HCanClass" + tableau[i].vehi.replace(/ /g, "");
                    var cpt = 0;
                    var tab1 = [];
                    var tab2 = [];
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var cons = Number(tableau[i].details[j].c[4].split(" ")[0]);
                        if (cons!==0) {
                            cpt++;
                            var conduc = tableau[i].details[j].c[1];
                            if (conduc === "") {
                                conduc = "conducteur non renseigné";
                            }
                            var date = new Date(tableau[i].details[j].t1 * 1000);
                            var year = date.getFullYear();
                            var month = date.getMonth()+1;
                            if (month<10) {
                                month = "0" + month;
                            }
                            var day = date.getDate();
                            if (day<10) {
                                day = "0" + day;
                            }
                            var hour = date.getHours();
                            if (hour<10) {
                                hour = "0" + hour;
                            }
                            var minute = date.getMinutes();
                            if (minute<10) {
                                minute = "0" + minute;
                            }
                            var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                            tab2.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[4].split(" ")[0] + " L/h</td><td>" + conduc + "</td></tr>");
                        }                        
                    }
                    if ((cpt % 2)!==0) {
                        tab2.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                    tab1.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + cpt + ")</strong></a></td><td><strong>" + tableau[i].cons + " L/h</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    if (cpt!==0) {
                        code.push(tab1 + tab2);
                        tabName.push(idTr);
                    } else {
                        code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/h</td><td>" + tableau[i].cond + "</td></tr>");
                    }
                } else {
                     code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L/h</td><td>" + tableau[i].cond + "</td></tr>");
                }
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
        
        function afficheDetailsConsoAMT() {
            var tableau =[];            
            var code = [];            
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="conso">' + translate('Consommation AMT') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');
            
            for (var i=0; i<donneesRapport.heures.length; i++) {
                var consoAMT = Number((donneesRapport.heures[i].c[2]).replace(/ lt/i, ""));
                if (consoAMT >= $('#filtreConsoAMTMin').val() && consoAMT <= $('#filtreConsoAMTMax').val()) {
                    var vehicule = donneesRapport.heures[i].c[0];                
                    var conduc = donneesRapport.heures[i].c[1];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }                
                    if (!donneesRapport.heures[i].details) {
                        var ligne = {vehi: vehicule, cons: consoAMT, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, cons: consoAMT, cond: conduc, details: donneesRapport.heures[i].details};
                    }
                    tableau.push(ligne);
                }                
            }            
            tableau.sort(function (b, a) {
               return a.cons - b.cons; 
            });   
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "amtId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "amtClass" + tableau[i].vehi.replace(/ /g, "");
                    var cpt = 0;
                    var tab1 = [];
                    var tab2 = [];
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var volume = Number(tableau[i].details[j].c[2].replace(/ lt/i, ""));
                        if (volume!==0) {
                            cpt++;
                            var conduc = tableau[i].details[j].c[1];
                            if (conduc === "") {
                                conduc = "conducteur non renseigné";
                            }
                            var date = new Date(tableau[i].details[j].t1 * 1000);
                            var year = date.getFullYear();
                            var month = date.getMonth()+1;
                            if (month<10) {
                                month = "0" + month;
                            }
                            var day = date.getDate();
                            if (day<10) {
                                day = "0" + day;
                            }
                            var hour = date.getHours();
                            if (hour<10) {
                                hour = "0" + hour;
                            }
                            var minute = date.getMinutes();
                            if (minute<10) {
                                minute = "0" + minute;
                            }
                            var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                            tab2.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[2].replace(/ lt/i, "") + "</td><td>" + conduc + "</td></tr>");
                        }                        
                    }
                    if ((cpt % 2)!==0) {
                        tab2.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                    tab1.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + cpt + ")</strong></a></td><td><strong>" + tableau[i].cons + " L</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    if (cpt!==0) {
                        code.push(tab1 + tab2);
                        tabName.push(idTr);
                    } else {
                        code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L</td><td>" + tableau[i].cond + "</td></tr>");
                    }
                } else {
                     code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].cons + " L</td><td>" + tableau[i].cond + "</td></tr>");
                }                
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
        
        function afficheDetailsKilometrage() {
            var tableau = [];
            var code = [];
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="kilometrage">' + translate('Kilométrage') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');
            
            for (var i=0; i<donneesRapport.trajets.length; i++) {
                var km = Number((donneesRapport.trajets[i].c[1]).replace(/ km/i, ""));                
                if (km >= $('#filtreKiloMin').val() && km <= $('#filtreKiloMax').val()) {
                    var vehicule = donneesRapport.trajets[i].c[0];                
                    var conduc = donneesRapport.trajets[i].c[4];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    if (!donneesRapport.trajets[i].details) {
                        var ligne = {vehi: vehicule, kil: km, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, kil: km, cond: conduc, details: donneesRapport.trajets[i].details};
                    }
                    tableau.push(ligne);
                }                
            }
            tableau.sort(function (b, a) {
                return a.kil - b.kil;
            });
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "kilId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "kilClass" + tableau[i].vehi.replace(/ /g, "");
                    tabName.push(idTr);
                    code.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + tableau[i].details.length + ")</strong></a></td><td><strong>" + tableau[i].kil + " Km</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var conduc = tableau[i].details[j].c[4];
                        if (conduc === "") {
                            conduc = "conducteur non renseigné";
                        }
                        var date = new Date(tableau[i].details[j].t1 * 1000);
                        var year = date.getFullYear();
                        var month = date.getMonth()+1;
                        if (month<10) {
                            month = "0" + month;
                        }
                        var day = date.getDate();
                        if (day<10) {
                            day = "0" + day;
                        }
                        var hour = date.getHours();
                        if (hour<10) {
                            hour = "0" + hour;
                        }
                        var minute = date.getMinutes();
                        if (minute<10) {
                            minute = "0" + minute;
                        }
                        var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                        code.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[1] + "</td><td>" + conduc + "</td></tr>");
                    }
                    if ((tableau[i].details.length % 2)!==0) {
                        code.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                } else {
                     code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].kil + " km</td><td>" + tableau[i].cond + "</td></tr>");
                }                
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
        
        function afficheDetailsHeures() {
            var tableau = [];
            var code = [];
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="heuresMoteur">' + translate('Heures moteur') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');
            
            for (var i=0; i<donneesRapport.heures.length; i++) {
                var tps = (donneesRapport.heures[i].c[5]).split(":");
                tps = (Number(tps[0]) * 3600) + (Number(tps[1]) * 60) + Number(tps[2]);
                if (tps >= (($('#filtreHeuresMin').val() * 3600) + ($('#filtreMinutesMin').val() * 60)) && tps <= (($('#filtreHeuresMax').val() * 3600) + ($('#filtreMinutesMax').val() * 60))) {
                    var vehicule = donneesRapport.heures[i].c[0];                
                    var conduc = donneesRapport.heures[i].c[1];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }    
                    if (!donneesRapport.heures[i].details) {
                        var ligne = {vehi: vehicule, temps: tps, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, temps: tps, cond: conduc, details: donneesRapport.heures[i].details};
                    }
                    tableau.push(ligne);
                }
            }
            tableau.sort(function (b, a) {
               return a.temps - b.temps;
            });
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "heuresId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "heuresClass" + tableau[i].vehi.replace(/ /g, "");
                    tabName.push(idTr);
                    code.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + tableau[i].details.length + ")</strong></a></td><td><strong>" + prepareOperTime(tableau[i].temps) + "</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var conduc = tableau[i].details[j].c[1];
                        if (conduc === "") {
                            conduc = "conducteur non renseigné";
                        }
                        var date = new Date(tableau[i].details[j].t1 * 1000);
                        var year = date.getFullYear();
                        var month = date.getMonth()+1;
                        if (month<10) {
                            month = "0" + month;
                        }
                        var day = date.getDate();
                        if (day<10) {
                            day = "0" + day;
                        }
                        var hour = date.getHours();
                        if (hour<10) {
                            hour = "0" + hour;
                        }
                        var minute = date.getMinutes();
                        if (minute<10) {
                            minute = "0" + minute;
                        }
                        var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                        code.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[5] + "</td><td>" + conduc + "</td></tr>");
                    }
                    if ((tableau[i].details.length % 2)!==0) {
                        code.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                } else {
                    code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + prepareOperTime(tableau[i].temps) + "</td><td>" + tableau[i].cond + "</td></tr>");
                }                
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
    
        function afficheDetailsPleins() {
            var tableau = [];
            var code = [];

            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="pleins">' + translate('Pleins') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');

            for (var i=0; i<donneesRapport.pleins.length; i++) {
                var plein = donneesRapport.pleins[i].c[1];
                if (plein === "-----") {
                    plein = 0;
                } else {
                    plein = Number(plein.replace(/ lt/i, ""));
                }
                if (plein >= $('#filtrePleinMin').val() && plein <= $('#filtrePleinMax').val()) {
                    var vehicule = donneesRapport.pleins[i].c[0];           
                    var conduc = donneesRapport.pleins[i].c[2];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }    
                    if (!donneesRapport.pleins[i].details) {
                        var ligne = {vehi: vehicule, pleins: plein, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, pleins: plein, cond: conduc, details: donneesRapport.pleins[i].details};
                    }
                    tableau.push(ligne);
                }            
            }
            tableau.sort(function (b, a) {
                return a.pleins - b.pleins;
            });
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "pleinsId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "pleinsClass" + tableau[i].vehi.replace(/ /g, "");
                    tabName.push(idTr);
                    code.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + tableau[i].details.length + ")</strong></a></td><td><strong>" + Number(tableau[i].pleins).toFixed() + " L</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var conduc = tableau[i].details[j].c[2];
                        if (conduc === "") {
                            conduc = "conducteur non renseigné";
                        }
                        var date = new Date(tableau[i].details[j].t1 * 1000);
                        var year = date.getFullYear();
                        var month = date.getMonth()+1;
                        if (month<10) {
                            month = "0" + month;
                        }
                        var day = date.getDate();
                        if (day<10) {
                            day = "0" + day;
                        }
                        var hour = date.getHours();
                        if (hour<10) {
                            hour = "0" + hour;
                        }
                        var minute = date.getMinutes();
                        if (minute<10) {
                            minute = "0" + minute;
                        }
                        var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                        code.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + Number(tableau[i].details[j].c[1].replace(/ lt/i, "")).toFixed(2) + " L</td><td>" + conduc + "</td></tr>");
                    }
                    if ((tableau[i].details.length % 2)!==0) {
                        code.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                } else {
                    code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + Number(tableau[i].pleins).toFixed() + " L</td><td>" + tableau[i].cond + "</td></tr>");
                }                
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }

        function afficheDetailsVols() {
            var tableau = [];
            var code = [];

            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="vols">' + translate('Vols carburant') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');

            for (var i=0; i<donneesRapport.vols.length; i++) {
                var vol = donneesRapport.vols[i].c[1];            
                if (vol === "-----") {
                    vol = 0;
                } else {
                    vol = Number(vol.replace(/ lt/i, ""));
                }           
                if (vol >= $('#filtreVolMin').val() && vol <= $('#filtreVolMax').val()) {
                    var vehicule = donneesRapport.vols[i].c[0];            
                    var conduc = donneesRapport.vols[i].c[2];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }       
                    if (!donneesRapport.vols[i].details) {
                        var ligne = {vehi: vehicule, vols: vol, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, vols: vol, cond: conduc, details: donneesRapport.vols[i].details};
                    }
                    tableau.push(ligne);
                }            
            }
            tableau.sort(function (b, a) {
                return a.vols - b.vols;
            });
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "volsId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "volsClass" + tableau[i].vehi.replace(/ /g, "");
                    tabName.push(idTr);
                    code.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + tableau[i].details.length + ")</strong></a></td><td><strong>" + Number(tableau[i].vols).toFixed() + " L</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var conduc = tableau[i].details[j].c[2];
                        if (conduc === "") {
                            conduc = "conducteur non renseigné";
                        }
                        var date = new Date(tableau[i].details[j].t1 * 1000);
                        var year = date.getFullYear();
                        var month = date.getMonth()+1;
                        if (month<10) {
                            month = "0" + month;
                        }
                        var day = date.getDate();
                        if (day<10) {
                            day = "0" + day;
                        }
                        var hour = date.getHours();
                        if (hour<10) {
                            hour = "0" + hour;
                        }
                        var minute = date.getMinutes();
                        if (minute<10) {
                            minute = "0" + minute;
                        }
                        var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                        code.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + Number(tableau[i].details[j].c[1].replace(/ lt/i, "")).toFixed(2) + " L</td><td>" + conduc + "</td></tr>");
                    }
                    if ((tableau[i].details.length % 2)!==0) {
                        code.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                } else {
                    code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + Number(tableau[i].vols).toFixed() + " L</td><td>" + tableau[i].cond + "</td></tr>");
                }                
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }

        function afficheDetailsNote() {
            var tableau = [];
            var code = [];

            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="eco">' + translate('Note éco-conduite') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');

            for (var i=0; i<donneesRapport.trajets.length; i++) {
                var eco = donneesRapport.trajets[i].c[3];            
                if (eco === "") {
                    eco = 0;
                } else {
                    eco = Number(eco);
                }            
                if (eco >= $('#filtreNoteMin').val() && eco <= $('#filtreNoteMax').val()) {
                    var vehicule = donneesRapport.trajets[i].c[0];            
                    var conduc = donneesRapport.trajets[i].c[4];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    if (!donneesRapport.trajets[i].details) {
                        var ligne = {vehi: vehicule, note: eco, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, note: eco, cond: conduc, details: donneesRapport.trajets[i].details};
                    }
                    tableau.push(ligne);
                }            
            }
            tableau.sort(function (b, a) {
                return a.note - b.note;
            });
            var tabName = [];
            for (var i = 0; i < tableau.length; i++) {
                if (tableau[i].details) { 
                    var idTr = "notesId" + tableau[i].vehi.replace(/ /g, "");
                    var classTr = "notesClass" + tableau[i].vehi.replace(/ /g, "");
                    tabName.push(idTr);
                    code.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + tableau[i].details.length + ")</strong></a></td><td><strong>" + tableau[i].note + "</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                    for (var j=0; j<tableau[i].details.length; j++) { 
                        var conduc = tableau[i].details[j].c[4];
                        if (conduc === "") {
                            conduc = "conducteur non renseigné";
                        }
                        var date = new Date(tableau[i].details[j].t1 * 1000);
                        var year = date.getFullYear();
                        var month = date.getMonth()+1;
                        if (month<10) {
                            month = "0" + month;
                        }
                        var day = date.getDate();
                        if (day<10) {
                            day = "0" + day;
                        }
                        var hour = date.getHours();
                        if (hour<10) {
                            hour = "0" + hour;
                        }
                        var minute = date.getMinutes();
                        if (minute<10) {
                            minute = "0" + minute;
                        }
                        var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;
                        code.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + tableau[i].details[j].c[3] + "</td><td>" + conduc + "</td></tr>");
                    }
                    if ((tableau[i].details.length % 2)!==0) {
                        code.push("<tr class='" + classTr + " invisible'></tr>");
                    }
                } else {
                    code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].note + "</td><td>" + tableau[i].cond + "</td></tr>");
                }                
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }
        
        function afficheDetailsCo2() {
            var tableau = [];
            var tab = [];
            var code = [];
            
            $tabhead.html('<tr><th class="vehicule">' + translate('Véhicule') + '</th><th class="eco">' + translate('Rejets CO2') + '</th><th class="conducteur">' + translate('Conducteur') + '</th></tr>');
            for (var i=0; i<donneesRapport.trajets.length; i++) {
                var consome = Number(donneesRapport.trajets[i].c[6].replace(/ lt/i, ""));
                var vehicule = donneesRapport.trajets[i].c[0];                    
                var coef;                        
                if (~tabDiesel.indexOf(vehicule)) {
                    coef = 2.67;
                } else if (~tabEssence.indexOf(vehicule)) {
                    coef = 2.28;
                } else if (~tabGPL.indexOf(vehicule)) {
                    coef = 1.66;
                } else {
                    coef = -1;
                }
                var co2 = consome*coef;
                if (co2 >= $('#filtreCo2Min').val() && co2 <= $('#filtreCo2Max').val()) {
                    var conduc = donneesRapport.trajets[i].c[4];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    if (!donneesRapport.trajets[i].details) {
                        var ligne = {vehi: vehicule, co2: co2, cond: conduc};
                    } else {
                        var ligne = {vehi: vehicule, co2: co2, cond: conduc, coef: coef, details: donneesRapport.trajets[i].details};
                    }
                    tableau.push(ligne);
                } else if (co2<0) {
                    co2 = translate('carburant non renseigné');
                    var conduc = donneesRapport.trajets[i].c[4];
                    if (conduc === "") {
                        conduc = translate('conducteur non renseigné');
                    } else if (conduc === "Drivers...") {
                        conduc = translate('conducteurs multiples');
                    }
                    var ligne = {vehi: vehicule, co2: co2, cond: conduc};
                    tab.push(ligne);
                }                                            
            }
            if (tableau.length) {
                tableau.sort(function (b, a) {
                    return a.co2 - b.co2;
                });
                var tabName = [];
                for (var i = 0; i < tableau.length; i++) {
                    if (tableau[i].details) { 
                        var idTr = "co2Id" + tableau[i].vehi.replace(/ /g, "");
                        var classTr = "co2Class" + tableau[i].vehi.replace(/ /g, "");
                        var tab1=[];
                        var tab2 = [];
                        var cpt = 0;
                        for (var j=0; j<tableau[i].details.length; j++) { 
                            var emi = Number(tableau[i].details[j].c[6].replace(/ lt/i, ""));
                            if (emi!==0) {
                                cpt++;
                                var conduc = tableau[i].details[j].c[4];
                                if (conduc === "") {
                                    conduc = "conducteur non renseigné";
                                }
                                var date = new Date(tableau[i].details[j].t1 * 1000);
                                var year = date.getFullYear();
                                var month = date.getMonth()+1;
                                if (month<10) {
                                    month = "0" + month;
                                }
                                var day = date.getDate();
                                if (day<10) {
                                    day = "0" + day;
                                }
                                var hour = date.getHours();
                                if (hour<10) {
                                    hour = "0" + hour;
                                }
                                var minute = date.getMinutes();
                                if (minute<10) {
                                    minute = "0" + minute;
                                }
                                var strDate = day + "/" + month + "/" + year + " - " + hour + ":" + minute;                            
                                tab2.push("<tr class='" + classTr + " invisible'><td>" + strDate + "</td><td>" + (emi*tableau[i].coef).toFixed(2) + " Kg</td><td>" + conduc + "</td></tr>");
                            }                            
                        }
                        if ((cpt % 2)!==0) {
                            tab2.push("<tr class='" + classTr + " invisible'></tr>");
                        }
                        tab1.push("<tr><td><a href='#ancre' id='" + idTr + "'><strong >" + tableau[i].vehi + " (" + tableau[i].details.length + ")</strong></a></td><td><strong>" + tableau[i].co2.toFixed(2) + " Kg</strong></td><td><strong>" + tableau[i].cond + "</strong></td></tr>");
                        if (cpt!==0) {
                            code.push(tab1 + tab2);
                            tabName.push(idTr);
                        } else {
                            code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].co2.toFixed(2) + " Kg</td><td>" + tableau[i].cond + "</td></tr>");
                        }
                    } else {
                        code.push("<tr><td>" + tableau[i].vehi + "</td><td>" + tableau[i].co2.toFixed(2) + " Kg</td><td>" + tableau[i].cond + "</td></tr>");
                    }                
                }
            }
            if (tab.length) {
                tab.sort(function (b, a) {
                    return a.vehi - b.vehi;
                });
                for (var i = 0; i < tab.length; i++) {
                    code.push("<tr><td>" + tab[i].vehi + "</td><td>" + tab[i].co2 + "</td><td>" + tab[i].cond + "</td></tr>");
                }
            }
            $tabbody.html(code);
            for (var j=0; j<tabName.length; j++) {
                document.getElementById(tabName[j]).setAttribute('onclick', 'recupId();');
                document.getElementById(tabName[j]).onclick = recupId;
            }
        }                
       
        function recupId() {
            var nom = this.id;
            nom = nom.replace(/Id/i, "Class");
            voirOuPasBloc(nom);
        }
       
        function voirOuPasBloc(className) {
            var lignes = document.getElementsByClassName(className);
            if (~lignes[0].getAttribute('class').indexOf("invisible")) {
                for (var i=0; i<lignes.length; i++) {
                    lignes[i].setAttribute('class', className + " visible");
                }
            } else {
                for (var i=0; i<lignes.length; i++) {
                    lignes[i].setAttribute('class', className + " invisible");
                }
            }
        }

        function modifOpt() {
            var coche = document.getElementById("voirOuPas").checked;
            if (coche) {
                montrerFiltres();
            } else {
                cacherFiltres();
            }
        }

        function montrerFiltres() {
            for (var i=0; i<document.getElementsByClassName('optionnel').length; i++) {
                document.getElementsByClassName('optionnel')[i].style.display = "inline";
            }
        }

        function cacherFiltres() {
            for (var i=0; i<document.getElementsByClassName('optionnel').length; i++) {
                document.getElementsByClassName('optionnel')[i].style.display = "none";
            }
        }
        
        function tableauDiesel() {
            var dataFlags = wialon.item.Item.dataFlag.base;
            var searchSpec = {
                itemsType:"avl_unit", // Type of the required elements of Wialon
                propName: "rel_profilefield_value", // Name of the characteristic according to which the search will be carried out
                propValueMask: "=diesel|Diesel|DIESEL",   // Meaning of the characteristic: can be used * | , > < =
                sortType: "rel_profilefield_value" // The name of the characteristic according to which you will be sorting a response
            };            

            session.searchItems(searchSpec, true, dataFlags, 0, 0, function(code, data) {            
                if (code) {
                    tabDiesel.push("Erreur");
                } else {
                    if (data.totalItemsCount === 0) {
                        tabDiesel.push("Pas de véhicule");
                    } else {
                        for (var i=0; i<data.totalItemsCount; i++) {
                            tabDiesel.push(data['items'][i].getName());
                        }
                    }
                }
                tableauEssence();
            });
        }
        
        function tableauEssence() {
            var dataFlags = wialon.item.Item.dataFlag.base;
            var searchSpec = {
                itemsType:"avl_unit", // Type of the required elements of Wialon
                propName: "rel_profilefield_value", // Name of the characteristic according to which the search will be carried out
                propValueMask: "=essence|Essence|ESSENCE",   // Meaning of the characteristic: can be used * | , > < =
                sortType: "rel_profilefield_value" // The name of the characteristic according to which you will be sorting a response
            };            

            session.searchItems(searchSpec, true, dataFlags, 0, 0, function(code, data) {            
                if (code) {
                    tabEssence.push("Erreur");
                } else {
                    if (data.totalItemsCount === 0) {
                        tabEssence.push("Pas de véhicule");
                    } else {
                        for (var i=0; i<data.totalItemsCount; i++) {
                            tabEssence.push(data['items'][i].getName());
                        }
                    }
                }
                tableauGPL();
            });
        }
        
        function tableauGPL() {
            var dataFlags = wialon.item.Item.dataFlag.base;
            var searchSpec = {
                itemsType:"avl_unit", // Type of the required elements of Wialon
                propName: "rel_profilefield_value", // Name of the characteristic according to which the search will be carried out
                propValueMask: "=gpl|Gpl|GPL",   // Meaning of the characteristic: can be used * | , > < =
                sortType: "rel_profilefield_value" // The name of the characteristic according to which you will be sorting a response
            };            

            session.searchItems(searchSpec, true, dataFlags, 0, 0, function(code, data) {            
                if (code) {
                    tabGPL.push("Erreur");
                } else {
                    if (data.totalItemsCount === 0) {
                        tabGPL.push("Pas de véhicule");
                    } else {
                        for (var i=0; i<data.totalItemsCount; i++) {
                            tabGPL.push(data['items'][i].getName());
                        }
                    }
                }
            });
        }
        
        function sortByName(a, b) {
            return sortString(a, b, "vehi");
        }
        
        function sortString(a, b, key) {
            var v1 = a[key].toLowerCase();
            var v2 = b[key].toLowerCase();
            if (v1<v2) return -1;
            if (v1>v2) return 1;
            return 0;
        }

        function prepareOperTime(time) {
            var h = Math.floor(time/3600);
            var m = Math.floor((time - h*3600)/60);
            var s = Math.floor(time - h*3600 - m*60);

            if(h === 24) {
                h = 23;
                m = 59;
                s = 59;
            }

            var stringTime = h + ':';

            stringTime += (m < 10) ? '0' + m + ':' : m + ':';

            stringTime += (s < 10) ? '0' + s : s;

            return stringTime;
        }
    
})(config);