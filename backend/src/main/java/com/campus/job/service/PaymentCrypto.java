package com.campus.job.service;

import cn.hutool.crypto.digest.HMac;
import cn.hutool.crypto.digest.HmacAlgorithm;
import com.campus.job.config.VirtualPaymentConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.xml.sax.InputSource;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;

@Component
@RequiredArgsConstructor
public class PaymentCrypto {
    private final VirtualPaymentConfig config;
    public static String hmac(String key, String raw) {
        return new HMac(HmacAlgorithm.HmacSHA256, key.getBytes(StandardCharsets.UTF_8))
                .digestHex(raw, StandardCharsets.UTF_8);
    }
    public static String sha1(String... parts) throws Exception {
        for (String p : parts) if (p == null || p.isEmpty()) throw new IllegalArgumentException("Missing signature field");
        Arrays.sort(parts);
        byte[] digest = MessageDigest.getInstance("SHA-1").digest(String.join("", parts).getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) hex.append(String.format("%02x", b & 255));
        return hex.toString();
    }
    private void equal(String actual, String expected) {
        if (actual == null || !MessageDigest.isEqual(actual.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8)))
            throw new IllegalArgumentException("Invalid signature");
    }
    public void verifyUrl(String signature, String timestamp, String nonce) throws Exception {
        config.requireReady();
        equal(signature, sha1(config.getCallbackToken(), timestamp, nonce));
    }
    public Document decrypt(String xml, String signature, String timestamp, String nonce) throws Exception {
        config.requireReady();
        // Require encrypted messages: a plaintext signature does not authenticate the message body.
        String encrypted = field(parse(xml).getDocumentElement(), "Encrypt");
        equal(signature, sha1(config.getCallbackToken(), timestamp, nonce, encrypted));
        byte[] key = Base64.getDecoder().decode(config.getEncodingAesKey() + "=");
        Cipher cipher = Cipher.getInstance("AES/CBC/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(Arrays.copyOf(key, 16)));
        byte[] plain = cipher.doFinal(Base64.getDecoder().decode(encrypted));
        int padding = plain[plain.length - 1] & 255;
        if (padding < 1 || padding > 32 || plain.length < 20 + padding) throw new IllegalArgumentException();
        for (int i = plain.length - padding; i < plain.length; i++) if ((plain[i] & 255) != padding) throw new IllegalArgumentException();
        int length = ByteBuffer.wrap(plain, 16, 4).getInt();
        if (length < 0 || length > plain.length - padding - 20) throw new IllegalArgumentException();
        equal(new String(plain, 20 + length, plain.length - padding - 20 - length, StandardCharsets.UTF_8), config.getAppid());
        return parse(new String(plain, 20, length, StandardCharsets.UTF_8));
    }
    public static Document parse(String xml) throws Exception {
        if (xml == null || xml.length() > 65536) throw new IllegalArgumentException();
        DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
        f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        f.setFeature("http://xml.org/sax/features/external-general-entities", false);
        f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        f.setXIncludeAware(false); f.setExpandEntityReferences(false);
        Document d = f.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
        if (!"xml".equals(d.getDocumentElement().getTagName())) throw new IllegalArgumentException();
        return d;
    }
    public static Element child(Element root, String name) {
        Element found = null;
        for (Node n = root.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element && name.equals(n.getNodeName())) {
                if (found != null) throw new IllegalArgumentException("Duplicate XML field");
                found = (Element) n;
            }
        }
        if (found == null) throw new IllegalArgumentException("Missing XML field");
        return found;
    }
    public static String field(Element root, String name) { return child(root, name).getTextContent(); }
}
