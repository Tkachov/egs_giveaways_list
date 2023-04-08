var requests = {
	_x: function () { return new XMLHttpRequest(); },

	_send: function (options) {
		var url = options.url;
		var method = ("method" in options ? options.method : "GET");
		var data = ("data" in options ? options.data : {});
		var headers = ("headers" in options ? options.headers : {});
		var auth = ("auth" in options ? options.auth : {user: undefined, password: undefined});
		var async = ("async" in options ? options.async : true);

		var callback = ("callback" in options ? options.callback : null);
		var error_callback = ("error_callback" in options ? options.error_callback : null);

		var x = this._x();
		x.open(method, url, async, auth.user, auth.password);
		x.onreadystatechange = function () {
			if (x.readyState == XMLHttpRequest.DONE) {
				if (x.status == 200) {
					if (callback != null) callback(x.responseText);
				} else {
					if (error_callback != null) error_callback(x);
				}
			}
		};

		for (var h in headers) {
			x.setRequestHeader(h, headers[h]);
		}
		if (method == 'POST') {
			x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		}

		x.send(data);
		return x;
	},

	get_raw: function (options) {
		var data = ("data" in options ? options.data : {});
		var query = [];
		for (var key in data) {
			query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
		}

		options.url = options.url + (query.length ? '?' + query.join('&') : '');
		options.method = "GET";
		options.data = null;

		return this._send(options);
	},

	post_raw: function (options) {
		var data = ("data" in options ? options.data : {});
		var query = [];
		for (var key in data) {
			query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
		}

		options.method = "POST";
		options.data = query.join('&');

		return this._send(options);
	},

	///

	_json_callbacks: function (options) {
		var callback = ("callback" in options ? options.callback : null);
		var error_callback = ("error_callback" in options ? options.error_callback : null);

		options.callback = function (responseText) {
			try {
				if (callback != null)
					callback(JSON.parse(responseText));
			} catch (e) {
				console.log(e.name + ": " + e.message);
				console.log(responseText);
				if (error_callback != null)
					error_callback(e);
			}
		};

		options.error_callback = function (x) {
			if (error_callback != null)
				error_callback("error: " + x.status);
		};

		return options;
	},

	get: function (options) {
		return this.get_raw(this._json_callbacks(options));
	},

	post: function (options) {
		return this.post_raw(this._json_callbacks(options));
	}
};
