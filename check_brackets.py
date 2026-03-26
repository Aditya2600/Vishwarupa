import io
with io.open(r"c:\Users\RentoBees\Desktop\vishvarupa_fix\Personalized-Video-Generator\Frontend\src\pages\BulkSend.tsx", mode="r", encoding="utf-8") as f:
    content = f.read()
print("Braces: {} vs {}".format(content.count("{"), content.count("}")))
print("Parens: {} vs {}".format(content.count("("), content.count(")")))
print("Brackets: {} vs {}".format(content.count("["), content.count("]")))
