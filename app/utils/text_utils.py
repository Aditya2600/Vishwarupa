import re

HINDI_DIGITS = ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छः", "सात", "आठ", "नौ"]

def normalize_hindi_numbers(text: str) -> str:
    """
    Convert numbers in the text into Hindi words to improve TTS pronunciation.
    - Phone numbers/IDs: Digit by digit.
    - Amounts: Lakh/Thousand conversion.
    """
    def replace_phone(match):
        digits = "".join(re.findall(r'\d', match.group(0)))
        if len(digits) >= 8:
            return " ".join([HINDI_DIGITS[int(d)] for d in digits])
        return match.group(0)

    def replace_amount(match):
        val_str = match.group(0)
        val = int(val_str)
        if val == 0: return HINDI_DIGITS[0]
        
        if val < 1000:
            return val_str
        
        words = []
        if val >= 10000000:
            crores = val // 10000000
            words.append(f"{crores} करोड़")
            val %= 10000000
        if val >= 100000:
            lakhs = val // 100000
            words.append(f"{lakhs} लाख")
            val %= 100000
        if val >= 1000:
            thousands = val // 1000
            words.append(f"{thousands} हजार")
            val %= 1000
        if val > 0:
            words.append(str(val))
        
        return " ".join(words)

    # Normalize phone numbers (10 digits or patterns like 1800-...)
    text = re.sub(r'\b\d{10}\b|\b1800[- ]\d{3}[- ]\d{3,4}\b', replace_phone, text)
    
    # Normalize large amounts (4+ digits)
    text = re.sub(r'\b\d{4,9}\b', replace_amount, text)
    
    return text
