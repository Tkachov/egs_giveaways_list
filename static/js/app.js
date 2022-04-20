const STORAGE_KEY = "cache";
const LOCALE = 'en', COUNTRY_CODE = 'US';

var controller = {
	cache: {},
	need_to_login: true,
	need_to_refresh_token: true,

	get_cache_user: function () {
		if (this.cache != null && "user" in this.cache) return this.cache.user;
		return null;
	},

	get_cache_library: function () {
		if (this.cache != null && "library" in this.cache) return this.cache.library;
		return null;
	},

	///

	init: function () {
		this.load_cache();
		this.update_library();
		this.render();

		var e = document.getElementById("name_filter");
		e.oninput = this.render.bind(this);
		e.onchange = this.render.bind(this);

		window.onhashchange = this.hash_changed.bind(this);
		this.hash_changed();
	},

	hash_changed: function () {		
		var hash = window.top.location.hash;
		if (hash.length > 1) {
			var eid = hash.substr(2);
			if (document.getElementById(eid) != null)
				this.show(eid);
			else
				this.show("all_giveaways");
		} else {
			this.show("all_giveaways");
		}
	},

	load_cache: function () {
		var v = load_from_storage(STORAGE_KEY);
		if (v != null) this.cache = v;
	},

	save_cache: function () {
		save_into_storage(STORAGE_KEY, this.cache);
	},

	get_headers: function () {
		var access_token = "";
		if (this.cache != null && "user" in this.cache && this.cache.user != null && "access_token" in this.cache.user) {
			access_token = this.cache.user.access_token;
		}
		return {'Authorization': 'bearer ' + access_token};
	},

	requests_get: function (url, callback, error_callback) {
		requests.get({
			url: url,
			callback: callback,
			error_callback: error_callback,
			headers: this.get_headers()
		});
	},

	requests_post: function (url, data, callback, error_callback) {
		requests.post({
			url: url,
			data: data,
			callback: callback,
			error_callback: error_callback,
			headers: this.get_headers()
		});
	},

	update_library: function () {
		this.need_to_login = true;
		this.need_to_refresh_token = true;

		if (this.cache != null && "user" in this.cache && this.cache.user != null) {
			var user = this.cache.user;
			var now = (+ new Date());
			
			if ("access_token" in user) {
				this.need_to_refresh_token = false;

				if ("expires_at" in user) {
					if (Date.parse(user.expires_at) <= now) {
						this.need_to_refresh_token = true;
					}
				}
			}

			if ("refresh_token" in user) {
				this.need_to_login = false;

				if ("refresh_expires_at" in user) {
					if (Date.parse(user.refresh_expires_at) <= now) {
						this.need_to_login = true;
					}
				}
			}
		}

		if (this.need_to_login) return;

		if (this.need_to_refresh_token) {
			this.refresh_access_token();
			return;
		}
		
		this.get_library();
	},

	_get_access_token: function (params) {
		var self = this;

		this.requests_post(
			'api/access_token', params,
			function(r) {
				if ("error" in r) {
					console.log('Login to EGS API failed with errorCode: ' + r["errorCode"]);
					return;
				}

				self.cache.user = r;
				self.save_cache();
				self.update_library();
				self.render();
				if ('exchange_code' in params)
					self.show('all_giveaways');
				else
					self.show(self.current_tab);
			},
			function(e) {
				console.log("oauth token FAIL", e);
			}
		);
	},

	refresh_access_token: function () {
		this._get_access_token({ refresh_token: this.cache.user.refresh_token });
	},

	get_library: function () {
		var self = this;
		
		this.requests_get(
			'api/library',
			function(r) {
				if ("errorCode" in r) {
					console.log(r);
					console.log("trying to refresh token...");
					this.refresh_access_token();
					return;
				}

				self.cache.library = r;
				self.precalculated = false;
				self.save_cache();
				self.render();
				self.show(self.current_tab); // show tabs which hid when library was empty
			},
			function(e) {
				console.log("get library FAIL", e);
			}
		);
	},

	///

	precalculated: false,
	unique_giveaway_items: [],
	taken_items: {},
	taken_items_count: 0,

	precalculate: function () {
		if (this.precalculated) return false;
		this.precalculated = true;

		this.unique_giveaway_items = [];
		this.taken_items = {};
		this.taken_items_count = 0;

		for (var item of giveaways_list) {
			if (item.item in this.taken_items) continue;

			this.unique_giveaway_items.push(item.item);
			this.taken_items[item.item] = false;
		}

		var library = this.get_cache_library();
		if (library != null) {
			for (var game of library) {
				var key = game.namespace + "_" + game.catalogItemId;
				if (key in this.taken_items) {
					if (this.taken_items[key]) continue;

					this.taken_items[key] = true;
					++this.taken_items_count;
				}
			}
		}

		return true;
	},

	last_filter: null,
	filtered_giveaways_list: [],
	filtered_unique_giveaway_items: [],
	filtered_taken_items: {},
	filtered_taken_items_count: 0,

	get_game_info: function (key) {
		if (key == null) return null;
		
		var ret = game_infos[key];
		if (ret == null) return null;

		var i = key.indexOf('_');
		var catalogItemId = key.substr(i+1);
		return ret[catalogItemId];
	},

	filter: function () {
		// get filters values

		var e = document.getElementById("name_filter");
		var filter = {"name": e.value};

		// compare

		var filter_changed = (this.last_filter == null);
		if (!filter_changed) {
			if (filter.name != this.last_filter.name)
				filter_changed = true;
		}

		if (!filter_changed) return false;

		// filter

		this.filtered_giveaways_list = [];
		this.filtered_unique_giveaway_items = [];
		this.filtered_taken_items = {};
		this.filtered_taken_items_count = 0;

		for (var item of giveaways_list) {
			if (item.item in this.filtered_taken_items) { // no need to check the filter again if item was already put in the map
				this.filtered_giveaways_list.push(item);
				continue;
			}

			if (!this.matches_filter(this.get_game_info(item.item), filter)) continue;

			this.filtered_giveaways_list.push(item);
			this.filtered_unique_giveaway_items.push(item.item);
			this.filtered_taken_items[item.item] = this.taken_items[item.item];
			if (this.taken_items[item.item])
				++this.filtered_taken_items_count;
		}

		return true;
	},

	matches_filter: function (game_info, filter) {
		if (game_info == null) return true;
		if (filter == null) return true;

		var matches_name_filter = true;
		if ("name" in filter) {
			var name_filter = filter.name;
			if (name_filter != null) {
				name_filter = name_filter.trim().toLowerCase();
				if (name_filter.trim() != "") {
					matches_name_filter = (game_info.title||"").toLowerCase().includes(name_filter);
				}
			}
		}

		if (!matches_name_filter) return false;

		return true;
	},

	///

	_is_library_ready: function () {
		var library = this.get_cache_library();
		return (!this.need_to_login && library != null);
	},

	render: function () {
		var e = document.getElementById("login_button");
		if (this.need_to_login) e.classList.remove("hidden");
		else e.classList.add("hidden");

		e = document.getElementById("logged_in_button");
		if (this.need_to_login) e.classList.add("hidden");
		else e.classList.remove("hidden");

		var user = this.get_cache_user();
		if (!this.need_to_login && user != null) {
			e = document.getElementById("display_name");
			e.innerHTML = "";
			e.appendChild(document.createTextNode(user.displayName));
		}

		///

		var changed = false;
		changed = this.precalculate() || changed;
		changed = this.filter() || changed;
		if (!changed) return;

		tab1_all_giveaways();
		var p = document.createElement("p");
		p.appendChild(document.createTextNode("Games given away: " + this.filtered_giveaways_list.length));
		p.appendChild(document.createElement("br"));
		p.appendChild(document.createTextNode("Unique ones: " + this.filtered_unique_giveaway_items.length));
		document.getElementById("all_giveaways").prepend(p);
		
		if (this._is_library_ready()) {
			tab2_missed_games();
			tab3_taken_games();

			p = document.createElement("p");
			p.appendChild(document.createTextNode("Games missed: " + (this.filtered_unique_giveaway_items.length - this.filtered_taken_items_count) + "/" + this.filtered_unique_giveaway_items.length));
			document.getElementById("missed_games").prepend(p);

			p = document.createElement("p");
			p.appendChild(document.createTextNode("Games taken: " + this.filtered_taken_items_count + "/" + this.filtered_unique_giveaway_items.length));
			document.getElementById("taken_games").prepend(p);
		}
	},

	///

	current_tab: "all_giveaways",

	show: function (id) {
		var can_see_personal_tabs = this._is_library_ready();

		function is_personal_tab(id) {
			return (id.includes("missed_games") || id.includes("taken_games"));
		}

		if (is_personal_tab(id) && !can_see_personal_tabs)
			id = "login";

		var tabs = document.querySelectorAll(".tab");
		var tab_contents = document.querySelectorAll(".content");

		for (var tab of tabs) {
			if (tab.href.includes(id)) tab.classList.add("selected");
			else tab.classList.remove("selected");

			if (is_personal_tab(tab.href)) {
				if (!can_see_personal_tabs) tab.classList.add("dimmed");
				else tab.classList.remove("dimmed");
			}
		}

		for (var content of tab_contents) {
			if (content.id == id) content.classList.add("open");
			else content.classList.remove("open");
		}

		this.current_tab = id;

		///

		var e = document.getElementById("filters_form");
		e.style.display = (id in {"login": 1, "logout": 1} ? "none" : "block");
	},

	login: function () {
		window.open("https://www.epicgames.com/id/login?redirectUrl=https://www.epicgames.com/id/api/redirect", "_blank");
	},

	login_accept_sid: function () {
		var e = document.getElementById("sid");
		var sid = e.value.replaceAll("\"", "").replaceAll("'", "").trim().replaceAll(" ", "");

		var self = this;
		this.requests_post(
			'api/auth', { sid: sid },
			function(r) {
				if ("error" in r) {
					console.log('Login to EGS API failed with errorCode: ' + r["errorCode"]);
					return;
				}

				self._get_access_token({ exchange_code: r.code });
			},
			function(e) {
				console.log("oauth token FAIL", e);
			}
		);	
	},

	logout: function () {
		this.cache = {};
		this.precalculated = false;
		this.save_cache();
		this.update_library();
		this.render();
		this.show("all_giveaways");
	}
};

this.onload = controller.init.bind(controller);

function save_into_storage(key, obj) {
	localStorage[key] = JSON.stringify(obj);
}

function load_from_storage(key) {
	var i = localStorage.getItem(key);
	if (i) return JSON.parse(i);
	return null;
}

///

function tab1_all_giveaways() {
	var e = document.getElementById("all_giveaways");
	e.innerHTML = "";
	e.appendChild(make_list(prepare_items(controller.filtered_giveaways_list, true), true, true));
}

function make_timespan_text(start, end, allow_short) {
	var short_start = start.substr(0, start.length-5);
	var short_end = end.substr(0, end.length-5);

	if (start == end) {
		return (allow_short ? short_start : start);
	}

	if (allow_short && start.substr(-4) == end.substr(-4)) {
		return short_start + " - " + short_end;
	}

	return start + " - " + end;
}

function prepare_items(items, short_timespans) {
	var result = [];

	for (var x of items) {
		var cur_year = x.start.substr(-4);

		var title = x.item;
		var img_src = "";
		if (x.item in game_infos) {
			var i = x.item.indexOf('_');
			var catalogItemId = x.item.substr(i+1);
			var info = game_infos[x.item][catalogItemId];
			title = info.title;

			var game_box_tall = null;
			var best = null;
			for (var img of info.keyImages) {
				if (img.type == "DieselGameBoxTall")
					game_box_tall = img.url;

				var area = img.width * img.height;
				if (area < 134 * 70) {
					continue; // too small to be the best
				}

				if (best == null) {
					best = img;
					continue;
				}

				var best_area = best.width * best.height;
				if (area < best_area) {
					best = img; // choose smaller pic
				}
			}

			if (game_box_tall != null)
				img_src = game_box_tall;
			else if (best != null)
				img_src = best.url;
		}

		var timespan = make_timespan_text(x.start, x.end, short_timespans);

		result.push({"year": cur_year, "img": img_src, "title": title, "timespans": timespan, "main_timespan": timespan, "key": x.item});
	}

	return result;
}

function make_list(items, add_years, mark_taken) {
	var d = document.createElement("div");
	d.className = "items_list";

	var prev_year = "";

	for (var x of items) {
		if (add_years) {
			var cur_year = x.year;
			if (prev_year != cur_year) {
				prev_year = cur_year;

				var h = document.createElement("h1");
				h.appendChild(document.createTextNode(prev_year));
				d.appendChild(h);
			}
		}

		var item = document.createElement("div");
		item.className = "item";
		
		var img = document.createElement("img");
		img.src = x.img;
		item.appendChild(img);

		var p = document.createElement("b");
		p.appendChild(document.createTextNode(x.title));
		item.appendChild(p);

		var span = document.createElement("span");
		span.appendChild(document.createTextNode(x.main_timespan));
		if (x.main_timespan != x.timespans) {
			var count = (x.timespans.match(/,/g) || []).length;
			span.appendChild(document.createTextNode(" +" + count));
			span.title = x.timespans;
		}
		item.appendChild(span);

		d.appendChild(item);
	}

	return d;
}

function filter_giveaways(is_taken) {
	var result = [];
	for (var item of controller.filtered_giveaways_list) {
		var taken = controller.filtered_taken_items[item.item];
		if (taken == is_taken)
			result.push(item);
	}
	return result;
}

function make_sorted_games_list(taken) {
	var items = prepare_items(filter_giveaways(taken), false);
	var unique_titles = {};
	
	for (var item of items) {
		if (item.key in unique_titles) {
			var other = unique_titles[item.key];
			var merged = {
				"year": "" + Math.min(parseInt(item.year), parseInt(other.year)),
				"img": item.img,
				"title": item.title,
				"main_timespan": other.main_timespan,
				"timespans": other.timespans + ", " + item.timespans,
				"key": item.key
			};
			unique_titles[item.key] = merged;
		} else {
			unique_titles[item.key] = item;
		}
	}

	var unique_items = [];
	for (var k in unique_titles) {
		unique_items.push(unique_titles[k]);
	}
	items = unique_items;

	items.sort(function (a, b) {
		if (a.title == b.title) return 0;
		return (a.title||"").toLowerCase() > (b.title||"").toLowerCase() ? 1 : -1;
		// return ('' + a.innerText).localeCompare(b.innerText);
	});

	return make_list(items, false, false);
}

function tab2_missed_games() {
	var e = document.getElementById("missed_games");
	e.innerHTML = "";
	e.appendChild(make_sorted_games_list(false));
}

function tab3_taken_games() {
	var e = document.getElementById("taken_games");
	e.innerHTML = "";
	e.appendChild(make_sorted_games_list(true));
}

///

function get_game_info(namespace, catalog_item_id) {
	controller.requests_post(
		'api/game_info',
		{
			"namespace": namespace,
			"catalog_item_id": catalog_item_id
		},
		
		function(r) {
			if ("errorCode" in r) {
				console.log(r);
				return;
			}

			console.log(r);
			game_infos[namespace + "_" + catalog_item_id] = r;
		},

		function(e) {
			console.log("get game info FAIL", e);
		}
	);
}

function get_meta() {
	function get_asset_meta(asset) {
		return function () {
			get_game_info(asset.namespace, asset.catalogItemId);
		};
	}

	var index = 0;
	for (var asset of controller.cache.library) {
		var key = asset.namespace + "_" + asset.catalogItemId;
		if (key in game_infos) continue;

		setTimeout(get_asset_meta(asset), index * 500);
		index += 1;
	}
}

function trimify(x) {
	return x.trim().toLowerCase().replace(":", "").replace("!", "").replace("-", "").replace("'", "");
}

function display(x) { var e = document.createElement("textarea"); e.value = JSON.stringify(x); document.body.innerHTML = ""; document.body.appendChild(e); }
