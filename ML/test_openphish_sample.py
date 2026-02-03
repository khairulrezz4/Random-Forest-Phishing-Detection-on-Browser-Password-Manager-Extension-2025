"""
Test specific OpenPhish URLs against the local phishing detection server.
"""
import requests
import json

SERVER_URL = "http://127.0.0.1:5000/predict_batch"

# OpenPhish URLs to test
urls = [
    "https://layanan-dana.teps.my.id/",
    "https://husrevaraci.com/",
    "https://www.conceptbutikotel.com/index-en",
    "https://bluewhaleusen.com/",
    "https://uk.paying-lt.vip/i",
    "https://www.suzuki-seikei.com/link02.html",
    "https://uk.paying-ck.vip/index.html",
    "http://webs-kraken-app.daftpage.com/",
    "https://uk.paying-co.vip/index.html",
    "https://uk.paying-vp.vip/i",
    "https://uk.paying-vd.vip/i",
    "https://uk.paying-vs.vip/i",
    "https://uk.paying-lp.vip/i",
    "http://sp829725.sitebeat.crazydomains.com/",
    "https://uk.paying-la.vip/i",
    "https://swisspost.zahlung2461.cfd/get/246251756",
    "https://uk.paying-lr.vip/i",
    "http://roomstayfinder.com/2722MT3J",
    "https://uk.paying-cl.vip/index.html/",
    "https://uk.paying-ci.vip/index.html/",
    "http://uk.paying-cd.vip/index.html",
    "https://yogisandyoginis.com/wp-content/zzdlls.htm",
    "http://uk.paying-xg.vip/index.html",
    "https://uk.paying-ce.vip/index.html/",
    "https://klarna-help.de/commerzbank/anmelden",
    "https://store.workshopdevcreated.com/sharedfiles/filesdetails/bounty_hunter_brims/",
    "https://workshopdevcreated.com/sharedfiles/filesdetails/bounty_hunter_brims/",
    "https://surl.li/euvukk",
    "http://uk.parking-qz.vip/i/",
    "https://www.andrea1997journal.blogspot.com/",
    "http://myjuno-login.framer.website/home-2",
    "https://bananbrain.com/3rff55ohznlgj4xb?token=3mail@a.b.c0&sub1=unsub",
    "https://bananbrain.com/y945ygj1scncpom5?token=3mail@a.b.c0&sub1=fkst",
    "http://tkmallallianceo6.top/",
    "http://gdmax.zeabur.app/",
    "http://extraordinary-works-028461.framer.app/",
    "https://home-sui-te-trez-or.typedream.app/",
    "https://krakeenlugginn.webflow.io/",
    "https://metaamasklugn.webflow.io/",
    "https://lognkrrkebn.webflow.io/",
    "http://easybank-landing-page-fm.vercel.app/",
    "http://rpcfixdapp.pages.dev/",
    "https://coinbasewalletaxtension.webflow.io/",
    "https://kreuikenloghn.webflow.io/",
    "https://f214n.xyz/",
    "https://y112l.xyz/",
    "https://krakanloge.webflow.io/",
    "https://sumitkumar044.github.io/netflix-clone/",
    "https://p109z.xyz/",
    "https://m19g.xyz/",
    "https://varun7142.github.io/my-ecommerce-project-2/",
    "https://roblox.com.ge/users/3914761689/profile",
    "https://bbvvxx.top/",
    "https://sahramgopal15-sys.github.io/amazon-clone.com/",
    "https://souki.vn/.e/9/emailprovider/signin/yahoo.php/yahoo_files/yahoo_files/r-sf.htm",
    "https://82900.xyz/",
    "https://e118r.xyz/",
    "https://x87g.xyz/",
    "https://s95l.xyz/",
    "https://b231p.xyz/",
    "https://dana.bantuan-help.my.id/",
    "https://uk.paying-xs.vip/index.html/",
    "http://roomstayfinder.com/49SVUDLL",
    "http://roomstayfinder.com/EAEMEQ3C",
    "https://kurekeans_usa_loagginis.godaddysites.com/",
    "http://www.kurekeans_usa_loagginis.godaddysites.com/",
    "http://walliet-ledger-login.vercel.app/",
    "http://hamzachehlaoui.github.io/login/",
    "http://trustwalletsupport.dev/",
    "https://group-visit10.com/5751711745",
    "https://public.gensparkspace.com/api/files/s/R6qWh9MT",
    "http://www.genspark.ai/api/files/s/R6qWh9MT",
    "http://gemini.inkstudying.com/",
    "https://africasia-institute.org/VipsClup1/",
    "http://ifylbnervous-dhawan.62-4-23-98.plesk.page/track/track.php",
    "http://ifylbnervous-dhawan.62-4-23-98.plesk.page/",
    "https://ichthyophthalmite.ssccare.com/aGhhQHN2Yi5jb20=",
    "https://wpclick.cc/JsfvyTxt/",
    "https://hellonetflix.blogspot.com/?m=1",
    "http://isamalta.org/website/web3.html",
    "http://bafybeidumje7chffoznwpxhlkvbxzigm24d6g4ojc56i2w45uyh2fx63i4.ipfs.dweb.link/",
    "http://aqknyozl.4qiuj.com/",
    "http://www.07q.co/",
    "http://195000333.com/",
    "http://pub-1f9bb5f4523840e990f568ef6df2cd67.r2.dev/index.html",
    "https://accountwarningfb.wixstudio.com/help",
    "http://bit.ly/48JI0DJ",
    "http://r2.gobookroom.com/",
    "https://amazonclone-two-gamma.vercel.app/",
    "http://www.amazonclone-two-gamma.vercel.app/",
    "http://wechatcorp.io/",
    "https://bananbrain.com/5tgvis9rrt9e?token=3mail@a.b.c0&sub1=jnefwnj",
    "http://bank-of-america-login.vercel.app/",
    "https://koukrinloig.webflow.io/",
    "https://uk.paying-bi.vip/i",
    "https://uk.paying-bw.vip/i",
    "https://0365ff.com/sport/19",
    "https://0365ff.com/about/deposit",
    "https://0365ff.com/fish/81",
    "http://mj-api.kun-ai.com/blog/xbox-stream-to-discord-announcement",
    "http://mj-api.kun-ai.com/blog/discord-patch-notes-october-7-2025",
    "http://mj-api.kun-ai.com/blog/discord-patch-notes-december-5-2024",
]

print(f"Testing {len(urls)} OpenPhish URLs")
print("=" * 80)

try:
    # Send batch request
    resp = requests.post(SERVER_URL, json={'urls': urls}, timeout=120)
    data = resp.json()
    
    if 'error' in data:
        print(f"Error: {data['error']}")
        print(f"Detail: {data.get('detail', 'N/A')}")
    else:
        results = data.get('results', [])
        
        # Count detections
        detected_as_phishing = 0
        detected_as_legit = 0
        errors = 0
        
        print("\nResults:")
        print("=" * 80)
        
        for i, result in enumerate(results, 1):
            url = result.get('url', 'unknown')
            
            if 'error' in result:
                errors += 1
                print(f"{i:3d}. ❌ ERROR")
                print(f"     {url}")
                print(f"     Error: {result['error']}\n")
            else:
                label = result.get('phishing_label', 'unknown')
                prob = result.get('probability')
                prob_str = f"{prob:.4f} ({prob*100:.1f}%)" if prob is not None else "N/A"
                
                if label == "phishing":
                    detected_as_phishing += 1
                    indicator = "🔴 PHISHING"
                else:
                    detected_as_legit += 1
                    indicator = "🟢 LEGIT"
                
                print(f"{i:3d}. {indicator} | Prob: {prob_str}")
                print(f"     {url}\n")
        
        # Summary
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total URLs tested:       {len(results)}")
        print(f"Detected as PHISHING:    {detected_as_phishing} ({detected_as_phishing/len(results)*100:.1f}%)")
        print(f"Detected as LEGITIMATE:  {detected_as_legit} ({detected_as_legit/len(results)*100:.1f}%)")
        print(f"Errors:                  {errors}")
        print("=" * 80)
        print(f"\n⚠️  Note: All these URLs are from OpenPhish (known phishing)")
        print(f"    Expected: 100% detection as phishing")
        print(f"    Actual:   {detected_as_phishing/len(results)*100:.1f}% detection rate")
        
except requests.exceptions.ConnectionError:
    print("❌ Error: Could not connect to server at http://127.0.0.1:5000")
    print("   Make sure to start the server first:")
    print("   cd ML && python server.py")
except Exception as e:
    print(f"❌ Error: {e}")
