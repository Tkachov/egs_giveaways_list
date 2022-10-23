from flask import Flask, url_for, send_from_directory, request, Response
import json
import requests

app = Flask(__name__)

#########################

# API impl

_user_agent = 'UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit'
_user_basic = '34a02cf8f4414e29b15921876da36f9a'
_pw_basic = 'daafbccc737745039dffe53d94fc76cf'

_oauth_host = 'account-public-service-prod03.ol.epicgames.com'
_catalog_host = 'catalog-public-service-prod06.ol.epicgames.com'
_library_host = 'library-service.live.use1a.on.epicgames.com'

language_code, country_code = ('en', 'US')
request_timeout = 10

def get_access_token(request):
	try:
		session = requests.session()
		session.headers['User-Agent'] = _user_agent
		_oauth_basic = requests.auth.HTTPBasicAuth(_user_basic, _pw_basic)

		params = None
		if request.form.get("refresh_token", None):
			params = {
				"grant_type": 'refresh_token',
				"refresh_token": request.form.get("refresh_token", None),
				"token_type": 'eg1'
			}
		elif request.form.get("authorization_code", None):
			params = {
				"grant_type": 'authorization_code',
				"code": request.form.get("authorization_code", None),
				"token_type": 'eg1'
			}
		else:
			params = {
				"grant_type": 'exchange_code',
				"exchange_code": request.form.get("exchange_code", None),
				"token_type": 'eg1'
			}

		r = session.post('https://' + _oauth_host + '/account/api/oauth/token', data=params, auth=_oauth_basic, timeout=request_timeout)
		return r.json()

	except Exception as e:
		return {"error": True, "message": e.message}

def get_game_info(request):
	try:
		session = requests.session()
		session.headers['User-Agent'] = _user_agent
		session.headers['Authorization'] = request.headers["Authorization"]
		_oauth_basic = requests.auth.HTTPBasicAuth(_user_basic, _pw_basic)

		namespace = request.form.get("namespace", None)
		params = {
			"id": request.form.get("catalog_item_id", None),
			"includeDLCDetails": True,
			"includeMainGameDetails": True,
			"country": country_code,
			"locale": language_code
		}

		r = session.get('https://' + _catalog_host + '/catalog/api/shared/namespace/' + namespace + '/bulk/items', params=params, timeout=request_timeout)
		return r.json()

	except Exception as e:
		return {"error": True, "message": e.message}

def get_library(request):
	try:
		session = requests.session()
		session.headers['User-Agent'] = _user_agent
		session.headers['Authorization'] = request.headers["Authorization"]
		_oauth_basic = requests.auth.HTTPBasicAuth(_user_basic, _pw_basic)

		include_metadata = True

		records = []
		r = session.get('https://' + _library_host + '/library/api/public/items', params=dict(includeMetadata=include_metadata), timeout=request_timeout)
		j = r.json()
		records.extend(j['records'])
		
		# Fetch remaining library entries as long as there is a cursor
		while True:
			if "responseMetadata" not in j:
				break

			cursor = j['responseMetadata'].get('nextCursor', None)
			if not cursor:
				break

			r = session.get('https://' + _library_host + '/library/api/public/items', params=dict(includeMetadata=include_metadata, cursor=cursor), timeout=request_timeout)
			j = r.json()
			records.extend(j['records'])

		return records

	except Exception as e:
		return {"error": True, "message": e.message}

#########################

# API

def json_wrap(ret):
	if ret is None:
		ret = {"error": True, "message": "unknown error"}
	json_response = json.dumps(ret)
	return Response(json_response, 200, {'Content-Type': 'application/json'})

@app.route("/api/access_token", methods=["POST"])
def api_post_access_token():
	return json_wrap(get_access_token(request))

@app.route("/api/game_info", methods=["POST"])
def api_post_game_info():
	return json_wrap(get_game_info(request))

@app.route("/api/library")
def api_get_library():
	return json_wrap(get_library(request))

#########################

# static stuff

@app.route('/')
def index():
	return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def send_static(path):
	return send_from_directory('static', path)

# error handling

def get_file_contents(filename):
	f = open(filename, 'r')
	res = f.read()
	f.close()
	return res

@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
def http_error_handler(error):	
	return get_file_contents('static/%d.html' % error.code), error.code
