var g_file_contents;
var api_key = 'AIzaSyBPSlgw6tIBOXCKG-_NI1IJQ9arfasjhVo';
var g_geo_point_precision = 6;
var g_max_points = 60;
var g_path_sample_factor = 5;
var g_path_samples = g_max_points * g_path_sample_factor;
var g_api_url = 'https://maps.googleapis.com/maps/api/elevation/json';

var g_all_trackpoints = [];
var g_distances_points = [];
var g_real_xaxis = [];
var g_tcx_altitudes = [];
var g_google_split_arrays = [];
var g_google_location_altitudes = [];
var g_google_path_altitudes = [];

var g_location_total_cnt = 0;
var g_location_receive_idx = 0;
var g_path_total_cnt = 0;
var g_path_receive_idx = 0;

var g_chart;
var g_path_chart;
var g_report_metrics = ['TCX Raw', 'Google Elevation by Location'];


function update_indicating_text(_text) {
  $("#pbar0 > p").text(_text);
}

function show_elevation_gain_loss() {
  var tcx_ele = cal_elevation_gain_loss(g_tcx_altitudes);
  var gl_ele = cal_elevation_gain_loss(g_google_location_altitudes);
  var gp_ele = cal_elevation_gain_loss(g_google_path_altitudes);
  $('#tcx-ele').html('<p class="text-success">Elevation Gain: '+tcx_ele[0]+'ft</p><p class="text-danger">Elevation Loss: '+tcx_ele[1]+'ft</p>');
  $('#gl-ele').html('<p class="text-success">Elevation Gain: '+gl_ele[0]+'ft</p><p class="text-danger">Elevation Loss: '+gl_ele[1]+'ft</p>');
  $('#gp-ele').html('<p class="text-success">Elevation Gain: '+gp_ele[0]+'ft</p><p class="text-danger">Elevation Loss: '+gp_ele[1]+'ft</p>');
  $('#elevation-div').show();
}

function _reset_vars() {
  g_all_trackpoints = [];
  g_distances_points = [];
  g_real_xaxis = [];
  g_tcx_altitudes = [];
  g_google_split_arrays = [];
  g_google_location_altitudes = [];
  g_google_path_altitudes = [];

  g_location_total_cnt = 0;
  g_location_receive_idx = 0;
  g_location_total_cnt = 0;
  g_location_receive_idx = 0;
}

function _reset() {
  _reset_vars();
  g_chart.destroy();
  g_path_chart.destroy();
  $("#pbar0").hide();
  $('#draw').hide();
  $('#draw_path').hide();
  $('#ele-div').hide();
}

function cal_elevation_gain_loss(altitudes_array) {
  var gain = 0;
  var loss = 0;
  for (var i = 1; i < altitudes_array.length; i++) {
    var diff = parseFloat(altitudes_array[i]) - parseFloat(altitudes_array[i-1]);
    if (diff > 0) {
        gain += diff;
    } else if (diff < 0) {
        loss -= diff;
    }
  }
  var r = [(gain*3.28084).toFixed(1), (loss*3.28084).toFixed(1)];
  return r;
}

function draw_highchart_from_path_data(input_data) {
  g_chart = new Highcharts.Chart({
    chart: {
        renderTo: 'draw_path'
    },
    title: {
        text: 'Elevation Charts Comparison',
        x: -20 //center
    },
    xAxis: { 
       lineWidth: 0,
       minorGridLineWidth: 0,
       lineColor: 'transparent',       
       labels: {
           enabled: false
       },
       minorTickLength: 0,
       tickLength: 0
    },
    yAxis: {
        title: {
            text: 'Elevation(ft)'
        },
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }]
    },
    tooltip: {
        valueSuffix: 'ft'
    },
    legend: {
        layout: 'vertical',
        align: 'right',
        verticalAlign: 'middle',
        borderWidth: 0
    },
    series: input_data
  });
}

function draw_highchart(input_data) {
  g_chart = new Highcharts.Chart({
    chart: {
        renderTo: 'draw'
    },
    title: {
        text: 'Elevation Charts Comparison',
        x: -20 //center
    },
    // subtitle: {
    //     text: 'Source: WorldClimate.com',
    //     x: -20
    // },
    xAxis: {
        categories: $.map( g_distances_points, function( ele ) {
            return (ele*0.000621371).toFixed(2)+' mi';
          }), 
    },
    yAxis: {
        title: {
            text: 'Elevation(ft)'
        },
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }]
    },
    tooltip: {
        valueSuffix: 'ft'
    },
    legend: {
        layout: 'vertical',
        align: 'right',
        verticalAlign: 'middle',
        borderWidth: 0
    },
    series: input_data
  });
}

function meter2feet(meter) {
  return meter * 3.28084;
} 
function prepare_draw_data() {
  var ready_data = [];
  ready_data.push( {'name':'TCX Raw', 'data':$.map( g_tcx_altitudes, meter2feet )} );
  ready_data.push( {'name':'Google Elevation by Location', 'data':$.map( g_google_location_altitudes, meter2feet )} );
  return ready_data;
}
function prepare_path_draw_data() {
  var ready_data = [];
  ready_data.push( {'name':'Google Elevation by Path', 'color': Highcharts.getOptions().colors[2], 'data':$.map( g_google_path_altitudes, meter2feet )} );
  return ready_data;
}

function init_fileinput() {
  $("#input-tcx").fileinput({
    'showPreview': true,
    'previewFileType':'tcx',
    'uploadLabel':'Show',
    'uploadTitle':'Show Elevation',
    'allowedFileTypes': ['tcx'],
    'allowedFileExtensions': ['tcx'],
    'allowedPreviewTypes': ['tcx'],
    'fileTypeSettings': {
      tcx: function(vType, vName) {
        return vName.match(/\.tcx$/i);
      }
    }, 
    previewSettings: {
      tcx: {width: "160px", height: "136px"},
    }, 
  });

  $('#input-tcx').on('fileloaded', function(event, file, previewId, index, reader) {
    g_file_contents = reader.result;
    _reset_vars();
  });
}

function async_get_google_maps_altitudes_path(geo_array) {
  $.getJSON(g_api_url, { 
    'path': geo_array.join('|'), 
    'samples': g_path_samples, 
    'key': api_key 
  })
  .done(function(data) {
    g_path_receive_idx++;
    update_indicating_text('Receiving '+g_path_receive_idx+'/'+g_path_total_cnt+' from Google Elevation by Path...');
    if (data.status == 'OK') {
      g_google_path_altitudes = g_google_path_altitudes.concat(
        $.map( data.results, function( ele ) {
          return ele.elevation;
        })
      );
      if (g_path_receive_idx == g_path_total_cnt) {
        $('#pbar0').hide();
        show_elevation_gain_loss();
        draw_highchart(prepare_draw_data());
        draw_highchart_from_path_data(prepare_path_draw_data());
      } else {
        // continue
        async_get_google_maps_altitudes_path(g_google_split_arrays[g_path_receive_idx]);
      }
    } else {
      var err = 'Cannot Get Altitude from Google Maps API! Reason:' + data.status;
      toastr.error(err);
      throw new Error(err);
    }
  })
  .fail(function() {
    toastr.error('Cannot Get Altitude from Google Maps API');
  })
  .always(function() {
    
  });   
}

function get_google_altitude_by_path() {
  g_google_path_altitudes = [];
  g_path_total_cnt = g_location_total_cnt;
  g_path_receive_idx = 0;
  async_get_google_maps_altitudes_path(g_google_split_arrays[0]);  
}

function async_get_google_maps_altitudes_location(geo_array) {
  $.getJSON(g_api_url, { 
    'locations': geo_array.join('|'), 
    'key': api_key 
  })
  .done(function(data) {
    g_location_receive_idx++;
    update_indicating_text('Receiving '+g_location_receive_idx+'/'+g_location_total_cnt+' from Google Elevation by Locations...');
    if (data.status == 'OK') {
      g_google_location_altitudes = g_google_location_altitudes.concat(
        $.map( data.results, function( ele ) {
          return ele.elevation;
        })
      );
      if (g_location_receive_idx == g_location_total_cnt) {
        console.log(cal_elevation_gain_loss(g_google_location_altitudes));
        //$('#pbar0').hide();
        //draw_highchart(prepare_draw_data());
        get_google_altitude_by_path();
      } else {
        // continue
        async_get_google_maps_altitudes_location(g_google_split_arrays[g_location_receive_idx]);
      }
    } else {
      var err = 'Cannot Get Altitude from Google Maps API! Reason:' + data.status;
      toastr.error(err);
      throw new Error(err);
    }
  })
  .fail(function() {
    toastr.error('Cannot Get Altitude from Google Maps API');
  })
  .always(function() {
    
  });   
}

function get_google_altitude_by_location() {
  g_google_location_altitudes = [];
  g_location_total_cnt = 0;
  g_location_receive_idx = 0;
	for (var i=0; i<g_all_geo_points.length; i+=g_max_points) {
    g_location_total_cnt++;
    g_google_split_arrays.push( g_all_geo_points.slice(i,i+g_max_points) );
  }
  async_get_google_maps_altitudes_location(g_google_split_arrays[0]);
}


function get_geo_points_from_tcx(raw_xml) {
  var arr = $.map( g_all_trackpoints, function( a ) {
    return parseFloat($(a).find('LatitudeDegrees').text()).toFixed(g_geo_point_precision)
      +','+parseFloat($(a).find('LongitudeDegrees').text()).toFixed(g_geo_point_precision);
  });
  return arr;
}
function get_distance_points_from_tcx(raw_xml) {
  var arr = $.map( g_all_trackpoints, function( a ) {
    return parseFloat($(a).find('DistanceMeters').text()).toFixed(g_geo_point_precision);
  });
  return arr;
}
function get_altitude_points_from_tcx(raw_xml) {
  var arr = $.map( g_all_trackpoints, function( a ) {
    return parseFloat($(a).find('AltitudeMeters').text()).toFixed(g_geo_point_precision);
  });
  return arr;
}
function get_common_data(raw_xml) {
  g_all_trackpoints = raw_xml.find("Trackpoint");
  g_all_geo_points = get_geo_points_from_tcx(raw_xml).filter(function(ele){
    return ele !== 'NaN,NaN';
  });
  g_distances_points = get_distance_points_from_tcx(raw_xml).filter(function(ele){
    return ele !== 'NaN';
  });
  g_tcx_altitudes = get_altitude_points_from_tcx(raw_xml).filter(function(ele){
    return ele !== 'NaN';
  });
}

function init_form_submit() {
  $('#main-form').submit(function( event ) {
    event.preventDefault();
    xmlDoc = $.parseXML( g_file_contents );
    $xml = $( xmlDoc );
    get_common_data($xml);
    $('#pbar0').show();
    get_google_altitude_by_location();
  });
}


$( document ).ready(function() {
  toastr.options = {
    "closeButton": true,
    "debug": false,
    "progressBar": false,
    "positionClass": "toast-bottom-full-width",
    "onclick": null,
    "showDuration": "500",
    "hideDuration": "500",
    "timeOut": "3000",
    "extendedTimeOut": "500",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  };

  init_fileinput();
  init_form_submit();
  $('[data-toggle="tooltip"]').tooltip();
});
