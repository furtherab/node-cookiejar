exports.CookieAccessInfo=CookieAccessInfo=function CookieAccessInfo(domain,path,secure,script) {
  if(this instanceof CookieAccessInfo) {
    this.domain=domain||undefined;
    this.path=path||"/";
    this.secure=!!secure;
    this.script=!!script;
    return this;
  }
  else {
    return new CookieAccessInfo(domain,path,secure,script)    
  }
}

exports.Cookie=Cookie=function Cookie(cookiestr) {
  if(cookiestr instanceof Cookie) {
    return cookiestr;
  }
  else {
    if(this instanceof Cookie) {
      this.name = null;
      this.value = null;
      this.expiration_date = Infinity;
      this.path = "/";
      this.domain = null;
      this.secure = false; //how to define?
      this.noscript = false; //httponly
      if(cookiestr) {
        this.parse(cookiestr)
      }
      return this;
    }
    return new Cookie(cookiestr)
  }
}

Cookie.prototype.toString = function toString() {
  var str=[this.name+"="+this.value];
  if(this.expiration_date !== Infinity) {
    str.push("expires="+(new Date(this.expiration_date)).toGMTString());
  }
  if(this.domain) {
    str.push("domain="+this.domain);
  }
  if(this.path) {
    str.push("path="+this.path);
  }
  if(this.secure) {
    str.push("secure");
  }
  if(this.noscript) {
    str.push("httponly");
  }
  return str.join("; ");
}

Cookie.prototype.toValueString = function toValueString() {
  return this.name+"="+this.value;
}

var cookie_str_splitter=/[:](?=\s*[a-zA-Z0-9_\-]+\s*[=])/g
Cookie.prototype.parse = function parse(str) {
  if(this instanceof Cookie) {
    var parts=str.split(";")
    , pair=parts[0].match(/([^=]+)=((?:.|\n)*)/)
    , key=pair[1]
    , value=pair[2];
    this.name = key;
    this.value = value;
    
    for(var i=1;i<parts.length;i++) {
      pair=parts[i].match(/([^=]+)(?:=((?:.|\n)*))?/)
      , key=pair[1].trim().toLowerCase()
      , value=pair[2];
      switch(key) {
        case "httponly":
          this.noscript = true;
        break;
        case "expires":
          this.expiration_date = value
            ? Number(Date.parse(value))
            : Infinity;
        break;
        case "path":
          this.path = value
            ? value.trim()
            : "";
        break;
        case "domain":
          this.domain = value
            ? value.trim()
            : "";
        break;
        case "secure":
          this.secure = true;
        break
      }
    }
    return this;
  }
  return new Cookie().parse(str)
}

Cookie.prototype.matches = function matches(access_info) {
  access_info = access_info instanceof CookieAccessInfo ? access_info : new CookieAccessInfo;
  return !(
    this.noscript && access_info.script
    || this.secure && !access_info.secure
    || !this.collidesWith(access_info)
  );
}

Cookie.prototype.collidesWith = function collidesWith(access_info) {
  access_info = access_info instanceof CookieAccessInfo ? access_info : new CookieAccessInfo;
  if((this.path && !access_info.path) || (this.domain && !access_info.domain)) {
    return false
  }
  if(this.path && access_info.path.indexOf(this.path) !== 0) {
    return false;
  }
  if (this.domain===access_info.domain) {
    return true;
  }
  else if(this.domain && this.domain.charAt(0)===".")
  {
    var wildcard=access_info.domain.indexOf(this.domain.slice(1))
    if(wildcard===-1 || wildcard!==access_info.domain.length-this.domain.length+1) {
      return false;
    }
  }
  else if(this.domain){
    return false
  }
  return true;
}

exports.CookieJar=CookieJar=function CookieJar() {
  if(!(this instanceof CookieJar)) return new CookieJar();
  this.cookies = {};
}

CookieJar.prototype.setCookie = function setCookie(cookie) {
  cookie = Cookie(cookie);
  //Delete the cookie if the set is past the current time
  var remove = cookie.expiration_date <= Date.now();
  if(cookie.name in this.cookies) {
    var cookies_list = this.cookies[cookie.name];
    for(var i=0;i<cookies_list.length;i++) {
      var collidable_cookie = cookies_list[i];
      if(collidable_cookie.collidesWith(cookie)) {
        if(remove) {
          cookies_list.splice(i,1);
          if(cookies_list.length===0) {
            delete this.cookies[cookie.name]
          }
          return false;
        }
        else {
          return cookies_list[i]=cookie;
        }
      }
    }
    if(remove) {
      return false;
    }
    cookies_list.push(cookie);
    return cookie;
  }
  else if(remove){
    return false;
  }
  else {
    return this.cookies[cookie.name]=[cookie];
  }
}

CookieJar.prototype.getCookie = function (cookie_name,access_info) {
  access_info = access_info instanceof CookieAccessInfo ? access_info : new CookieAccessInfo;
  var cookies_list = this.cookies[cookie_name] || [];
  for(var i=0;i<cookies_list.length;i++) {
    var cookie = cookies_list[i];
    if(cookie.expiration_date <= Date.now()) {
      if(cookies_list.length===0) {
        delete this.cookies[cookie.name]
      }
      continue;
    }
    if(cookie.matches(access_info)) {
      return cookie;
    }
  }
}

CookieJar.prototype.getCookies = function (access_info) {
  access_info = access_info instanceof CookieAccessInfo ? access_info : new CookieAccessInfo;
  var matches=[];
  for(var cookie_name in this.cookies) {
    var cookie=this.getCookie(cookie_name,access_info);
    if (cookie) {
      matches.push(cookie);
    }
  }
  matches.toString=function() {return matches.join(":");};
  matches.toValueString=function() {return matches.map(function(c){return c.toValueString();}).join(';');};
  return matches;
}

//returns list of cookies that were set correctly
CookieJar.prototype.setCookies = function setCookies(cookies) {
  if(typeof(cookies) === 'string') cookies = cookies.split(cookie_str_splitter);
  if(!Array.isArray(cookies)) throw new TypeError('First argument to method must be either an Array or a String');
  var successful=[]
  for(var i=0;i<cookies.length;i++) {
    var cookie = Cookie(cookies[i]);
    if(this.setCookie(cookie)) {
      successful.push(cookie);
    }
  }
  return successful;
}
