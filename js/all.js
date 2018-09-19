if (location.protocol !== 'https:' && location.hostname !== 'localhost'){
	location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
}

var API_URL = 'https://api-proxy.noob.tw/https://data.tycg.gov.tw/api/v1/rest/datastore/64c62af1-481b-4040-8a9e-1680e330eb17?format=json&sort=_id+desc&limit=500';

var works = {};
var works_time = {};
var works_district = [];
var charts = [];
var map, mapSmall, markerEvent = [];
var districts = ['桃園區', '中壢區', '大溪區', '楊梅區', '蘆竹區', '大園區', '龜山區', '八德區', '龍潭區', '平鎮區', '新屋區', '觀音區', '復興區'];
var weeklyData, mapData, mapDataSmall;

var intervalTimeline;

$(function(){
	$('#day').on('change', function(){
		if($(this).val()){
			var day = moment($(this).val()).format('YYYY-MM-DD');
			load(day);
		}
	});

	$('section').hide();
	$('section.dashboard').show().animateCss('fadeIn');

	$('nav ul li').on('click', function(){
		$('section').hide();
		$('section.' + $(this).data('to')).show().animateCss('fadeIn');
		$(this).addClass('active').siblings().removeClass('active');

		switch($(this).data('to')){
			case 'dashboard':
				$('header h1').text('桃園市 1999 市政儀表板');
				break;
			case 'list':
				$('header h1').text('桃園市 1999 報案總覽');
				break;
			case 'map':
				resetTimeline();
				$('header h1').text('桃園市 1999 報案時空分佈');
				break;
			case 'the-streamgraph':
				chart(column,filterBy,groupBy);
				$('header h1').text('桃園市 1999 量化波形圖');
				break;
			default:

		}
	});

	$('#yesterday').on('click', function(){
		var day = moment($('#day').val()).add(-1, 'days').format('YYYY-MM-DD')
		$('#day').val(day);
		load(day);
	});

	$('#tomorrow').on('click', function(){
		var day = moment($('#day').val()).add(1, 'days').format('YYYY-MM-DD');
		$('#day').val(day);
		load(day);
	});

	$('#today').on('click', function(){
		var day = moment(new Date()).format('YYYY-MM-DD');
		$('#day').val(day);
		load(day);
	});

	$(document).scroll(function() {
		if ($(this).scrollTop() > $(window).height()) {
		  $('#go-top').fadeIn();
		} else {
		  $('#go-top').fadeOut(1000);
		}
	});

	$('#go-top').on('click', function(){
		$("html, body").animate({
			scrollTop: 0
		}, {
			duration: 500,
			easing: "swing"
		});
	});
});

function initMap(){
	mapSmall = L.map('map_small').setView([24.863991, 121.265851], 10);
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '<a href="https://www.openstreetmap.org/">OSM</a>',
		maxZoom: 18,
	}).addTo(mapSmall);

	map = L.map('map').setView([24.863991, 121.265851], 10);
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '<a href="https://www.openstreetmap.org/">OSM</a>',
		maxZoom: 18,
	}).addTo(map);

	$.getJSON('./data/taoyuan.json', function(r){
		mapDataSmall = L.geoJSON(r, {color: '#333', weight: 0.7}).addTo(mapSmall);
		mapData = L.geoJSON(r, {color: '#333', weight: 0.7}).addTo(map);
	});

	var day = moment(new Date()).format('YYYY-MM-DD');
	$('#day').val(day);

	load(day);
}

function load(day, skipLoading = false){
	works_time = {};
	if(skipLoading !== true){
		$('#loading').show();
	}else{
		if(
			moment(new Date).format('YYYY-MM-DD') !==
			moment($('#day').val()).format('YYYY-MM-DD')
		) return;
	}
	$('.work').each(function(){
		works[$(this).attr('id')] = {};
		Array.from(charts).forEach(function(c){
			c.destroy();
		});
	});
	for(var i=0;i<districts.length;i++){
		works_district[i] = 0;
	}
	for(var i=0;i<markerEvent.length;i++){
		map.removeLayer(markerEvent[i]);
	}
	markerEvent = [];

	$.getJSON(API_URL + '&filters={"ACCEPT_DATE":"' + day + '"}', function(r){
		var res = r.result.records;
		var maxWorkDistrct = 0;
		var workAchiveCount = 0;
		var workAchiveProCount = 0;
		var workAchiveProTime = 0;

		$('#list-table').find('tbody').html('')
		$('#count-today').find('.work-count').text(~~res.length);
		for(var i=0;i<res.length;i++){
			var event = res[i];
			console.log(event)
			var work = getCategoryByName(event.CATEGORY);

			if(event.occurY_WGS84 && event.occurX_WGS84){
				var iconpath = getIconpathByWork(work);
				var d = parseInt(event.ACCEPT_TIME.substr(0, 2) , 10) * 60 + parseInt(event.ACCEPT_TIME.substr(3, 2), 10);
				var marker = L.marker([event.occurY_WGS84, event.occurX_WGS84], {
					icon: L.icon({
						iconUrl: iconpath,
					}),
					CASEID: event.CASEID,
					time: d,
					type: work,
				});
				marker.addTo(map);
				marker.on('click', function(){
					$('nav ul li').get(1).click();
					var CASEID = this.options.CASEID;
					var target = $('#list-table').find('tr').filter(function(){
						return $(this).html().includes(CASEID);
					});
					var top = target.offset().top;
					$('html, body').stop().animate({scrollTop: top - 100}, 500, 'swing');
					setTimeout(function(){
						$(target).animateCss('flash')
					}, 500);
				});
				markerEvent.push(marker);
			}

			if(!works[work]) works[work] = {};
			if(!works_time[hour]) works_time[hour] = {};

			var hour = parseInt(event.ACCEPT_TIME.substr(0, 2), 10);

			works[work].total = !isNaN(works[work].total) ? works[work].total+1 : 1;
			works[work][hour] = !isNaN(works[work][hour]) ? works[work][hour]+1 : 1;
			works_time[hour] = !isNaN(works_time[hour]) ? works_time[hour] + 1 : 1;
			works_district[ districts.indexOf(event.TOWN) ]++;
			if(works_district[ districts.indexOf(event.TOWN) ] > maxWorkDistrct) maxWorkDistrct = works_district[ districts.indexOf(event.TOWN) ];

			// desc = event.beforeDesc;
			// if(event.afterDesc){
			// 	desc += '<br><br><div style="padding-left: 1rem"><i class="fas fa-hand-point-right"></i>' + event.afterDesc + '</div>';
			// }else if(~~event.status === 1 && event.beforeDesc.trim() === ''){
			// 	desc = '<span style="color: #777">建立案件中......</span>'
			// }

			var status = 0;
			switch(event.STATUS){
				case '處理中':
					status = 1;
					break;
				case '滿意度調查中':
					status = 2;
					break;
				case '結案':
					status = 3;
					break;
				default:
					status = 0;
			}

			var scale = chroma.scale(['#B71C1C', '#9CCC65']);
			var color = scale(status / 3).hex();

			$($('#list-table').find('tbody')[0]).append(
				'<tr data-type="' + work + '">'+
				'<td style="border-left: 5px solid '+ color +'">' + event.CASEID + '</td>' +
				'<td style="border-left-color: '+ color +'">' + event.TOWN + '</td>' +
				'<td>' + event.ADDRESS + '</td>' +
				'<td>' + event.CATEGORY + '</td>' +
				'<td>' + event.ACCEPT_TIME.substr(0, 5) + '</td>' +
				'</tr>'
			);

			if(status >= 3) workAchiveCount++;
			if(status === 3){
				workAchiveProCount++;
				workAchiveProTime += new Date(event.close_Date) - new Date(event.cre_Date);
			}
		}
		$('#count-achivement').find('.work-count').text(Math.floor((100 * workAchiveCount / res.length) || 0) + '%');
		$('#count-achivement-pro').find('.work-count').text(Math.floor((100 * workAchiveProCount / res.length) || 0) + '%');
		$('#count-achivement-time-pro').find('.work-count').text(moment.duration((workAchiveProTime / workAchiveProCount) || 0).locale('zh-tw').humanize())
		var scale = chroma.scale(['#B71C1C', '#9CCC65']);
		$('#count-achivement').css('background', scale(workAchiveCount / res.length).hex());
		$('#count-achivement-pro').css('background', scale(workAchiveProCount / res.length).hex());
		Object.keys(works).forEach(function(w){
			if($('#' + w).find('canvas').length){
				$('#' + w).find('.work-count').text(works[w].total || 0);
				var ctx = $('#' + w).find('canvas');
				var dataLine = [];

				for(var i=0;i<24;i++){
					if(!isNaN(works[w][''+ i])){
						dataLine.push(works[w][i]);
					}else{
						dataLine.push(0);
					}
				}

				generateChart(ctx, dataLine);
			}
		});
		var countToday = [];
		for(var i=0;i<24;i++){
			if(!isNaN(works_time[i])){
				countToday.push(works_time[i]);
			}else{
				countToday.push(0);
			}
		}
		generateChart($('#count-today').find('canvas'), countToday);

		var chart = new Chart($('#count-donut').find('canvas'), {
			type: 'doughnut',
			data: {
				datasets: [{
					data:
						Object.keys(works)
						.filter(function(x){return x !== 'undefined'})
						.filter(function(x){return works[x].total})
						.map(function(x){return works[x].total})
						.sort(function(a, b){return b-a}),
					backgroundColor: ['#66C2A5', '#FC8D62', '#8Da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#B3B3B3']
				}],
				labels:
					Object.keys(works)
					.filter(function(x){return x !== 'undefined'})
					.filter(function(x){return works[x].total})
					.sort(function(a, b){return works[b].total - works[a].total})
					.map(function(x){return getNameByCategory(x)})
			},
			options: {
				legend: {
					display: false
				}
			}
		});
		charts.push(chart);

		if(mapData){
			mapDataSmall.eachLayer(function(layer){
				var name = layer.feature.properties.TOWN;
				var count = works_district[districts.indexOf(name)];

				var percent = count / maxWorkDistrct;
				var scale = chroma.scale(['white', '#D00000']);

				layer.setStyle({
					fillColor: scale(percent).hex(),
					fillOpacity: 0.7,
				});
			});
		}

		if(mapData) {
			mapData.eachLayer(function(layer){
				var name = layer.feature.properties.TOWN;
				var count = works_district[districts.indexOf(name)];

				var percent = count / maxWorkDistrct;
				var scale = chroma.scale(['white', '#D00000']);

				layer.setStyle({
					fillColor: scale(percent).hex(),
					fillOpacity: 0.7,
				});
			});
		}

		$('#loading').hide();
		loadYesterday(day);
	});

	$.getJSON(API_URL + '&filters={"ACCEPT_DATE":"' + day + '"}', function(r){
		var res = r.result.records;
		var streamgraphRawData = [];
		Array.from(res).forEach(function(event){
			var type = getNameByCategory(getCategoryByName(event.CATEGORY));
			var time = '20' + event.ACCEPT_TIME.substr(0, 2);
			streamgraphRawData.push({
				year: time,
				place: type,
				type: 'tycg',
			});
			if(time === '2023'){
				streamgraphRawData.push({
					year: '2024',
					place: type,
					type: 'tycg',
				});
			}
		});
		window.weeklyData = streamgraphRawData;
		$('.streamgraph-wrapper h3').text('今日報案類型');
		if($('header h1').text() === '桃園市 1999 量化波形圖') chart(column,filterBy,groupBy);
	});

	resetTimeline();
}

$('.map-filter').on('click', function(){
	$(this).addClass('active').siblings().removeClass('active');
	if(markerEvent.length){
		if($(this).data('filter') !== 'all'){
			markerEvent.forEach(function(m){
				map.removeLayer(m);
			});
			var filter = $(this).data('filter');
			markerEvent.filter(function(x){return x.options.type === filter}).forEach(function(m){
				map.addLayer(m);
			});
		}else{
			markerEvent.forEach(function(m){
				map.addLayer(m);
			});
		}
	}
});

$('.list-filter').on('click', function(){
	$(this).addClass('active').siblings().removeClass('active');
	if($(this).data('filter') !== 'all'){
		var filter = $(this).data('filter');
		$('#list-table').find('tr').hide();
		$('#list-table').find('tr').filter(function(){return $(this).data('type') === filter;}).show();
	}else{
		$('#list-table').find('tr').show();
	}
});

function generateChart(ctx, dataLine){
	var chart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: ['0:00', '1:00', '2:00', '3:00', '4:00', '5:00',
				'6:00', '7:00', '8:00', '9:00', '10:00', '11:00',
				'12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
				'18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
			],
			// labels: ['0', '1', '2', '3', '4', '5',
			// 	'6', '7', '8', '9', '10', '11',
			// 	'12', '13', '14', '15', '16', '17',
			// 	'18', '19', '20', '21', '22', '23'
			// ],
			datasets: [{
				label: '受理案件',
				backgroundColor: '#FFBA08',
				borderColor: '#FFBA08',
				data: dataLine,
			}]
		},
		options: {
			legend: {
				display: false
			},
			tooltips: {
				callbacks: {
					label: function(tooltipItem) {
						return tooltipItem.yLabel;
					}
				}
			},
			scales: {
				yAxes: [{
					ticks: {
						beginAtZero: true
					}
				}]
			},
		}
	});
	charts.push(chart);
}

function startTimeline(){
	var speed = ~~$('.timeline-speed').text().slice(0, -1);
	$('.timeline-play').html('<i class="fas fa-pause" />');
	if(intervalTimeline) clearInterval(intervalTimeline);
	intervalTimeline = setInterval(function(){
		var n = $('.timeline input').val();
		$('.timeline input').val(~~n + 1);
		$('.timeline input').change();
	}, 1000 / speed);
	$('.timeline-play').off('click');
	$('.timeline-play').on('click', function(){stopTimeline()});
}

function stopTimeline(){
	$('.timeline-play').html('<i class="fas fa-play" />');
	if(intervalTimeline) clearInterval(intervalTimeline);
	$('.timeline-play').on('click', function(){startTimeline()});
}

function resetTimeline(){
	stopTimeline();
	$('.timeline input').val(new Date().getHours() * 60 + new Date().getMinutes());
	$('.timeline-now').text(moment(new Date()).format('HH:mm'));
}

$('.timeline-play').on('click', function(){startTimeline(1)});
$('.timeline-fast').on('click', function(){
	var speed = ~~$('.timeline-speed').text().slice(0, -1);
	if(speed < 16) speed *= 2;
	$('.timeline-speed').text(speed + 'x');
	stopTimeline();
	startTimeline();
});
$('.timeline-slow').on('click', function(){
	var speed = ~~$('.timeline-speed').text().slice(0, -1);
	if(speed > 1) speed /= 2;
	$('.timeline-speed').text(speed + 'x');
	stopTimeline();
	startTimeline();
});
$('.timeline input').on('change', function(){
	var range = $(this).val();
	markerEvent.filter(function(x){
		return x.options.time <= range;
	}).forEach(function(m){
		if(m.map !== map) map.addLayer(m);
	});
	markerEvent.filter(function(x){
		return x.options.time > range;
	}).forEach(function(m){
		map.removeLayer(m);
	});
	var n = $('.timeline input').val();
	var hh = Math.floor(n / 60);
	if(hh < 10) hh = '0' + hh;
	var mm = Math.floor(n % 60);
	if(mm < 10) mm = '0' + mm;

	$('.timeline input').val(~~n + 1);
	$('.timeline-now').text(hh + ':' + mm);
});

function loadYesterday(day){
	var day = moment(day).add(-1, 'day').format('YYYY-MM-DD');
	var works_yesterday = {};
	var works_time_yesterday = {};

	$.getJSON(API_URL + '&filters={"ACCEPT_DATE":"' + day + '"}', function(r){
		var res = r.result.records;
		if(res.length){
			var maxWorkDistrct = 0;
			var workAchiveCount = 0;
			var workAchiveProCount = 0;
			var workAchiveProTime = 0;

			for(var i=0;i<res.length;i++){
				var event = res[i];

				var work = getCategoryByName(event.CATEGORY);

				if(!works_yesterday[work]) works_yesterday[work] = {};
				if(!works_time_yesterday[hour]) works_time_yesterday[hour] = {};

				var hour = parseInt(event.ACCEPT_TIME.substr(0, 2), 10);

				works_yesterday[work].total = !isNaN(works_yesterday[work].total) ? works_yesterday[work].total+1 : 1;
				works_yesterday[work][hour] = !isNaN(works_yesterday[work][hour]) ? works_yesterday[work][hour]+1 : 1;
				works_time_yesterday[hour] = !isNaN(works_time_yesterday[hour]) ? works_time_yesterday[hour] + 1 : 1;

				if(~~event.status >= 4) workAchiveCount++;
				if(~~event.status === 5){
					workAchiveProCount++;
					workAchiveProTime += new Date(event.close_Date) - new Date(event.cre_Date);
				}
			}
			works_yesterday[work][hour] = !isNaN(works_yesterday[work][hour]) ? works_yesterday[work][hour]+1 : 1;
			Object.keys(works).forEach(function(w){
				if(!works_yesterday[w]) works_yesterday[w] = {total: 0};
			});
			Object.keys(works_yesterday).forEach(function(w){
				var count = 0;
				var hour = new Date().getHours();
				if(moment(day).add(1, 'days').unix() < moment(new Date().setHours(0, 0, 0, 0)).unix()) hour = 23;
				for(var i=0;i<=hour;i++){
					works_yesterday[work][hour] = !isNaN(works_yesterday[work][hour]) ? works_yesterday[work][hour]+1 : 1;
					if(!isNaN(works_yesterday[w][i])) count += works_yesterday[w][i];
				}
				if(!isNaN(Number($('#' + w).find('.work-count').text()))){
					var now = Number($('#' + w).find('.work-count').text());
					var a = now - count;
					var text = (a >= 0 ? '△ +' : '▽ ') + a + '(' + (a >= 0 ? '+' : '') + Math.floor(count > 0 ? (100 * a / count) : (100 * a / 1)) + '%)'
					$('#' + w).find('.yesterday-count').text(text);
					$('#' + w).find('.yesterday-desc').text('和前一天此時相比');
				}
				// var now = Number($('#' + w).find('.work-count').text());
				// var a = now - count;
				// var text = (a >= 0 ? '△ +' : '▽ ') + a + '(' + (a >= 0 ? '+' : '') + Math.floor(100 * a / (count || 1)) + '%)'
				// $('#' + w).find('.yesterday-count').text(text);
				// $('#' + w).find('.yesterday-desc').text('和前一天此時相比');
			});
			var now = Number($('#count-today').find('.work-count').text());
			var a = now - res.length;
			var text = (a >= 0 ? '△ +' : '▽ ') + a + '(' + (a >= 0 ? '+' : '') + Math.floor(100 * a / res.length) + '%)'
			$('#count-today').find('.yesterday-count').text(text);
			$('#count-today').find('.yesterday-desc').text('和前一天此時相比');
		}
	});
}

function getIconpathByWork(work){
	var iconpath = './image/';
	switch(work){
		case 'work-road':
			iconpath += 'road.png'; break;
		case 'work-pipe':
			iconpath += 'tint.png'; break;
		case 'work-light':
			iconpath += 'lightbulb.png'; break;
		case 'work-park':
			iconpath += 'tree.png'; break;
		case 'work-traffic':
			iconpath += 'sign.png'; break;
		case 'work-car':
			iconpath += 'car.png'; break;
		case 'work-noise':
			iconpath += 'bullhorn.png'; break;
		case 'work-animal':
			iconpath += 'paw.png'; break;
		case 'work-view':
			iconpath += 'seedling.png'; break;
		case 'work-water':
			iconpath += 'bath.png'; break;
		case 'work-electricity':
			iconpath += 'bolt.png'; break;
		case 'work-gas':
			iconpath += 'industry.png'; break;
		default:
			iconpath += 'question.png';
	}
	return iconpath;
}

function getCategoryByName(name){
	switch(name){
		case '路面不平整':
		case '道路施工時間、交通管制及安全管理問題':
		case '公車問題及站牌、候車亭設施管理':
			return 'work-road';
		case '水溝溝蓋維修':
		case '道路淹(積)水通報':
			return 'work-pipe';
		case '路燈故障':
		case '路燈新增或遷移申請':
			return 'work-light';
		case '公園、綠地及路樹養護':
		case '公園設施損壞':
		case '新闢公園建議案':
		case '路樹傾倒':
			return 'work-park';
		case '交通號誌(紅綠燈)故障或損壞傾斜':
		case '交通號誌增設或紅綠燈秒數調整':
		case '交通標誌、標線、反射鏡設置或移除':
		case '交通標誌牌面、反射鏡損壞傾斜':
			return 'work-traffic';
		case '防火巷違建、堆放雜物':
		case '違規招牌或樹立廣告物查報':
		case '占用道路、騎樓及人行道':
		case '交通疏導或壅塞通報':
		case '有牌廢棄車查報':
		case '計程車問題及招呼站設施管理':
		case '無牌廢棄車查報':
		case '路邊停車格問題':
		case '監視器問題':
		case '廣告車輛長期占用停車格':
		case '闖紅燈(超速)照相桿增設或維護':
			return 'work-car';
		case '工廠排放廢水、河川污染':
		case '空氣污染':
		case '綜合性環境污染':
		case '營業場所、工廠及施工噪音':
		case '一般住宅噪音(人與動物噪音)':
		case '大型廢棄物清運預約':
		case '改裝車噪音':
		case '路面油漬清除':
		case '道路側溝清淤或惡臭處理':
		case '違規張貼廣告物':
		case '髒亂點查報':
			return 'work-noise';
		case '動物受困、受傷通報':
			return 'work-animal';
		 case '水、電、瓦斯等公用事業問題':
			return 'work-electricity';
	}
}

function getNameByCategory(x){
	switch(x){
		case 'work-road': return '道路不平';
		case 'work-pipe': return '積水、汙水管';
		case 'work-light': return '路燈故障';
		case 'work-park': return '公園、路樹、人行道';
		case 'work-traffic': return '交通號誌';
		case 'work-car': return '交通違規、路霸';
		case 'work-noise': return '髒亂、噪音、空汙';
		case 'work-animal': return '動物保護';
		case 'work-view': '風景區維護';
		case 'work-water': return '自來水相關';
		case 'work-electricity': return '電力相關';
		case 'work-gas': return '不明氣體外洩';
	}
}

$.fn.extend({
	animateCss: function(animationName, callback) {
	var animationEnd = (function(el) {
		var animations = {
		animation: 'animationend',
		OAnimation: 'oAnimationEnd',
		MozAnimation: 'mozAnimationEnd',
		WebkitAnimation: 'webkitAnimationEnd',
		};

		for (var t in animations) {
			if (el.style[t] !== undefined) {
				return animations[t];
			}
		}
	})(document.createElement('div'));

	this.addClass('animated ' + animationName).one(animationEnd, function() {
		$(this).removeClass('animated ' + animationName);

		if (typeof callback === 'function') callback();
	});

	return this;
	},
});

setInterval(function(){
	load(moment(new Date).format('YYYY-MM-DD'), true);
}, 60000);

initMap();
