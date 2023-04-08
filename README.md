# egsgiveawayslist.com [down]

**UPD 04.2023:** site is now disabled, but the list of giveaways (without login logic) still available via [Github Pages](https://tkachov.github.io/egs_giveaways_list/)

This is a small simple site that allows you to check which of the Epic Games Store free games you have or haven't on your account.
Unfortunately, it requires logging into the account to list the games in the library.  
If you don't, it simply shows all of the games that were ever given away — which might be useful for somebody too.

![egsgiveawayslist.com screenshot](https://user-images.githubusercontent.com/1948111/164341867-6fb8422d-bcf7-481f-bd63-effea034542a.png)

Originally, the idea was to implement that completely on client side and store **access_token/refresh_token** in browser's **localStorage**.
That didn't work because of the [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).

But since it has server side now, via this repo you can check that no data is collected.
The server side is a single Python file that has 3 API endpoints — basically proxies for actual EGS APIs.
Those endpoints implementations are hugely based on [Legendary](https://github.com/derrod/legendary) open-source launcher.

If you have any ideas on how to make this site more useful (for example, show the current week free games or have a link to the games' 
Store pages) — don't hesitate to send a PR (=

